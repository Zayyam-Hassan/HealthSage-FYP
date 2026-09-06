import mongoose from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import { AppointmentSlot, type AppointmentSlotDocument } from '../models/AppointmentSlot';
import {
  DoctorAvailability,
  type DoctorAvailabilityDocument,
  type Weekday,
  weekdayValues,
} from '../models/DoctorAvailability';
import { Doctor, type DoctorDocument } from '../models/Doctor';
import { Patient, type PatientDocument } from '../models/Patient';
import {
  ScheduledAppointment,
  type ScheduledAppointmentDocument,
  type ScheduledAppointmentStatus,
} from '../models/ScheduledAppointment';
import type { JwtPayload } from '../utils/jwt';

/** Upper bound for how far ahead we generate / list slots (rolling window). */
const MAX_GENERATION_DAYS = 31;
/** When `days_ahead` is omitted, use at least this many calendar days so every weekday can appear. */
const DEFAULT_SCHEDULING_HORIZON_DAYS = 14;
const MIN_SLOT_DURATION_MINUTES = 5;
const MAX_SLOT_DURATION_MINUTES = 120;
/** Idle time between consecutive slot end and next slot start (buffer / turnaround). */
const GAP_BETWEEN_SLOTS_MINUTES = 10;

export interface AvailabilityInput {
  weekday: Weekday;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  break_start_time?: string | null;
  break_end_time?: string | null;
  is_active?: boolean;
}

export interface GenerateSlotsInput {
  days_ahead?: number;
  start_date?: string;
}

export interface SlotListInput {
  doctor_id: string;
  days_ahead?: number;
  status?: 'available' | 'booked' | 'blocked' | 'cancelled' | 'completed';
}

export interface BookAppointmentInput {
  slot_id: string;
  reason_for_visit?: string;
  patient_note?: string;
}

export interface AppointmentListInput {
  status?: ScheduledAppointmentStatus;
  limit?: number;
}

export interface AppointmentUpdateInput {
  doctor_note?: string;
}

export class SchedulingError extends Error {
  status: number;
  detail?: unknown;

  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

export interface SchedulingAvailabilityResponse {
  id: string;
  doctor_id: string;
  weekday: Weekday;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  break_start_time: string | null;
  break_end_time: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SchedulingSlotResponse {
  id: string;
  doctor_id: string;
  availability_id: string | null;
  slot_date: string;
  start_datetime: string;
  end_datetime: string;
  status: 'available' | 'booked' | 'blocked' | 'cancelled' | 'completed';
  display_date: string;
  display_time: string;
  appointment_id?: string | null;
  appointment_status?: ScheduledAppointmentStatus | null;
  patient_name?: string | null;
  doctor_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SchedulingAppointmentResponse {
  id: string;
  slot_id: string;
  doctor_id: string;
  patient_id: string;
  doctor_name: string | null;
  patient_name: string | null;
  counterpart_name: string | null;
  status: ScheduledAppointmentStatus;
  reason: string;
  reason_for_visit: string;
  patient_note: string | null;
  doctor_note: string | null;
  booked_at: string;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  display_date: string | null;
  display_time: string | null;
  slot: SchedulingSlotResponse | null;
}

function toObjectId(value: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(value);
}

function parseTimeToMinutes(value: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) {
    throw new SchedulingError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      'Time must use HH:mm format',
    );
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateOnlyString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateWithMinutes(date: Date, minutes: number): Date {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hours,
    remainder,
    0,
    0,
  );
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
}

/** Inclusive days from `date` (normalized to start of day) through the last day of that calendar month. */
function daysFromDateThroughEndOfMonthInclusive(date: Date): number {
  const d0 = startOfDay(date);
  const y = d0.getFullYear();
  const m = d0.getMonth();
  const lastDayOfMonth = new Date(y, m + 1, 0).getDate();
  const dayOfMonth = d0.getDate();
  return lastDayOfMonth - dayOfMonth + 1;
}

/**
 * How many calendar days (start from `rangeStart`) to include for slot generation / listing.
 * - If `days_ahead` is omitted: use at least {@link DEFAULT_SCHEDULING_HORIZON_DAYS} so a short
 *   "rest of month" window (e.g. 1 day on March 31) does not yield zero slots when the weekday
 *   does not match that single day.
 * - If `days_ahead` is set: honor it (up to {@link MAX_GENERATION_DAYS}).
 */
function resolveSchedulingHorizonDays(
  inputDaysAhead: number | undefined,
  rangeStart: Date,
): number {
  const monthCap = daysFromDateThroughEndOfMonthInclusive(rangeStart);
  if (inputDaysAhead != null) {
    return Math.min(Math.max(inputDaysAhead, 1), MAX_GENERATION_DAYS);
  }
  const defaultDays = Math.min(
    Math.max(monthCap, DEFAULT_SCHEDULING_HORIZON_DAYS),
    MAX_GENERATION_DAYS,
  );
  return Math.max(defaultDays, 1);
}

function normalizeBulkWriteUpsertCount(result: unknown): number {
  if (result == null) return 0;
  const r = result as {
    upsertedCount?: number;
    upserted?: unknown[];
    result?: { upserted?: unknown[] };
  };
  if (typeof r.upsertedCount === 'number') return r.upsertedCount;
  if (Array.isArray(r.upserted)) return r.upserted.length;
  if (Array.isArray(r.result?.upserted)) return r.result.upserted.length;
  return 0;
}

function rangesOverlap(
  firstStart: number,
  firstEnd: number,
  secondStart: number,
  secondEnd: number,
): boolean {
  return firstStart < secondEnd && secondStart < firstEnd;
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDisplayTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}

async function getDoctorByUserId(userId: string): Promise<DoctorDocument | null> {
  return Doctor.findOne({ user_id: toObjectId(userId) });
}

async function getPatientByUserId(userId: string): Promise<PatientDocument | null> {
  return Patient.findOne({ user_id: toObjectId(userId) });
}

async function requireDoctorForUser(userId: string): Promise<DoctorDocument> {
  const doctor = await getDoctorByUserId(userId);
  if (!doctor) {
    throw new SchedulingError(StatusCodes.NOT_FOUND, 'Doctor profile not found');
  }
  return doctor;
}

async function requirePatientForUser(userId: string): Promise<PatientDocument> {
  const patient = await getPatientByUserId(userId);
  if (!patient) {
    throw new SchedulingError(StatusCodes.NOT_FOUND, 'Patient profile not found');
  }
  return patient;
}

function mapAvailability(
  availability: DoctorAvailabilityDocument,
): SchedulingAvailabilityResponse {
  return {
    id: availability.id,
    doctor_id: availability.doctor_id.toString(),
    weekday: availability.weekday,
    start_time: availability.start_time,
    end_time: availability.end_time,
    slot_duration_minutes: availability.slot_duration_minutes,
    break_start_time: availability.break_start_time ?? null,
    break_end_time: availability.break_end_time ?? null,
    is_active: availability.is_active,
    created_at: availability.created_at.toISOString(),
    updated_at: availability.updated_at.toISOString(),
  };
}

function mapSlot(
  slot: AppointmentSlotDocument,
  options?: {
    appointment?: ScheduledAppointmentDocument | null;
    patientName?: string | null;
    doctorName?: string | null;
  },
): SchedulingSlotResponse {
  return {
    id: slot.id,
    doctor_id: slot.doctor_id.toString(),
    availability_id: slot.availability_id?.toString() ?? null,
    slot_date: slot.slot_date,
    start_datetime: slot.start_datetime.toISOString(),
    end_datetime: slot.end_datetime.toISOString(),
    status: slot.status,
    display_date: formatDisplayDate(slot.start_datetime),
    display_time: formatDisplayTime(slot.start_datetime),
    appointment_id: options?.appointment?.id ?? null,
    appointment_status: options?.appointment?.status ?? null,
    patient_name: options?.patientName ?? null,
    doctor_name: options?.doctorName ?? null,
    created_at: slot.created_at.toISOString(),
    updated_at: slot.updated_at.toISOString(),
  };
}

function mapAppointment(
  appointment: ScheduledAppointmentDocument,
  slot: AppointmentSlotDocument | null,
  doctorName: string | null,
  patientName: string | null,
  viewerRole: JwtPayload['role'],
): SchedulingAppointmentResponse {
  return {
    id: appointment.id,
    slot_id: appointment.slot_id.toString(),
    doctor_id: appointment.doctor_id.toString(),
    patient_id: appointment.patient_id.toString(),
    doctor_name: doctorName,
    patient_name: patientName,
    counterpart_name: viewerRole === 'doctor' ? patientName : doctorName,
    status: appointment.status,
    reason: appointment.reason_for_visit ?? '',
    reason_for_visit: appointment.reason_for_visit ?? '',
    patient_note: appointment.patient_note ?? null,
    doctor_note: appointment.doctor_note ?? null,
    booked_at: appointment.booked_at.toISOString(),
    cancelled_at: appointment.cancelled_at
      ? appointment.cancelled_at.toISOString()
      : null,
    created_at: appointment.created_at.toISOString(),
    updated_at: appointment.updated_at.toISOString(),
    display_date: slot ? formatDisplayDate(slot.start_datetime) : null,
    display_time: slot ? formatDisplayTime(slot.start_datetime) : null,
    slot: slot
      ? mapSlot(slot, {
          appointment,
          patientName,
          doctorName,
        })
      : null,
  };
}

async function ensureAvailabilityPayloadIsValid(
  doctorId: mongoose.Types.ObjectId,
  input: AvailabilityInput,
  excludeId?: string,
): Promise<void> {
  const startMinutes = parseTimeToMinutes(input.start_time);
  const endMinutes = parseTimeToMinutes(input.end_time);

  if (endMinutes <= startMinutes) {
    throw new SchedulingError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      'End time must be after start time',
    );
  }

  if (
    input.slot_duration_minutes < MIN_SLOT_DURATION_MINUTES ||
    input.slot_duration_minutes > MAX_SLOT_DURATION_MINUTES
  ) {
    throw new SchedulingError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      `Slot duration must be between ${MIN_SLOT_DURATION_MINUTES} and ${MAX_SLOT_DURATION_MINUTES} minutes`,
    );
  }

  const breakStart =
    input.break_start_time === undefined || input.break_start_time === null
      ? null
      : parseTimeToMinutes(input.break_start_time);
  const breakEnd =
    input.break_end_time === undefined || input.break_end_time === null
      ? null
      : parseTimeToMinutes(input.break_end_time);

  if ((breakStart === null) !== (breakEnd === null)) {
    throw new SchedulingError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      'Break start and end times must both be provided',
    );
  }

  if (
    breakStart !== null &&
    breakEnd !== null &&
    (breakStart < startMinutes ||
      breakEnd > endMinutes ||
      breakEnd <= breakStart)
  ) {
    throw new SchedulingError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      'Break time must fall inside the availability window',
    );
  }

  if (input.is_active === false) {
    return;
  }

  const filter: {
    doctor_id: mongoose.Types.ObjectId;
    weekday: Weekday;
    is_active: boolean;
    _id?: { $ne: mongoose.Types.ObjectId };
  } = {
    doctor_id: doctorId,
    weekday: input.weekday,
    is_active: true,
  };

  if (excludeId) {
    filter._id = { $ne: toObjectId(excludeId) };
  }

  const existingAvailabilities = await DoctorAvailability.find(filter);
  const conflicts = existingAvailabilities.some((availability) =>
    rangesOverlap(
      parseTimeToMinutes(availability.start_time),
      parseTimeToMinutes(availability.end_time),
      startMinutes,
      endMinutes,
    ),
  );

  if (conflicts) {
    throw new SchedulingError(
      StatusCodes.CONFLICT,
      'Availability windows for the same day cannot overlap',
    );
  }
}

function buildSlotCandidates(
  availability: DoctorAvailabilityDocument,
  date: Date,
  now: Date,
): Array<{ slotDate: string; startDatetime: Date; endDatetime: Date }> {
  const startMinutes = parseTimeToMinutes(availability.start_time);
  const endMinutes = parseTimeToMinutes(availability.end_time);
  const breakStart =
    availability.break_start_time !== null &&
    availability.break_start_time !== undefined
      ? parseTimeToMinutes(availability.break_start_time)
      : null;
  const breakEnd =
    availability.break_end_time !== null &&
    availability.break_end_time !== undefined
      ? parseTimeToMinutes(availability.break_end_time)
      : null;

  const items: Array<{
    slotDate: string;
    startDatetime: Date;
    endDatetime: Date;
  }> = [];

  const stepMinutes =
    availability.slot_duration_minutes + GAP_BETWEEN_SLOTS_MINUTES;

  for (
    let cursor = startMinutes;
    cursor + availability.slot_duration_minutes <= endMinutes;
    cursor += stepMinutes
  ) {
    const slotStart = cursor;
    const slotEnd = cursor + availability.slot_duration_minutes;

    if (
      breakStart !== null &&
      breakEnd !== null &&
      rangesOverlap(slotStart, slotEnd, breakStart, breakEnd)
    ) {
      continue;
    }

    const startDatetime = dateWithMinutes(date, slotStart);
    const endDatetime = dateWithMinutes(date, slotEnd);

    if (startDatetime <= now) {
      continue;
    }

    items.push({
      slotDate: dateOnlyString(startDatetime),
      startDatetime,
      endDatetime,
    });
  }

  return items;
}

async function loadSlotsAndAppointments(
  appointments: ScheduledAppointmentDocument[],
): Promise<Map<string, AppointmentSlotDocument>> {
  const slotIds = appointments.map((appointment) => appointment.slot_id);
  const slots = await AppointmentSlot.find({ _id: { $in: slotIds } });
  return new Map(slots.map((slot) => [slot.id, slot]));
}

async function loadNamesForAppointments(appointments: ScheduledAppointmentDocument[]): Promise<{
  doctorNames: Map<string, string>;
  patientNames: Map<string, string>;
}> {
  const doctorIds = [...new Set(appointments.map((item) => item.doctor_id.toString()))];
  const patientIds = [...new Set(appointments.map((item) => item.patient_id.toString()))];

  const [doctors, patients] = await Promise.all([
    Doctor.find({ _id: { $in: doctorIds } }),
    Patient.find({ _id: { $in: patientIds } }),
  ]);

  return {
    doctorNames: new Map(doctors.map((doctor) => [doctor.id, doctor.name])),
    patientNames: new Map(patients.map((patient) => [patient.id, patient.full_name])),
  };
}

async function loadSlotContext(slotId: mongoose.Types.ObjectId): Promise<{
  appointment: ScheduledAppointmentDocument | null;
  patientName: string | null;
}> {
  const appointment = await ScheduledAppointment.findOne({ slot_id: slotId });
  if (!appointment) {
    return { appointment: null, patientName: null };
  }

  const patient = await Patient.findById(appointment.patient_id);
  return {
    appointment,
    patientName: patient?.full_name ?? null,
  };
}

async function getAccessibleAppointment(
  user: JwtPayload,
  appointmentId: string,
): Promise<{
  appointment: ScheduledAppointmentDocument;
  slot: AppointmentSlotDocument;
  doctorName: string | null;
  patientName: string | null;
}> {
  if (!mongoose.isValidObjectId(appointmentId)) {
    throw new SchedulingError(StatusCodes.NOT_FOUND, 'Appointment not found');
  }

  const appointment = await ScheduledAppointment.findById(appointmentId);
  if (!appointment) {
    throw new SchedulingError(StatusCodes.NOT_FOUND, 'Appointment not found');
  }

  const slot = await AppointmentSlot.findById(appointment.slot_id);
  if (!slot) {
    throw new SchedulingError(StatusCodes.NOT_FOUND, 'Appointment slot not found');
  }

  const [doctor, patient] = await Promise.all([
    Doctor.findById(appointment.doctor_id),
    Patient.findById(appointment.patient_id),
  ]);

  if (!doctor || !patient) {
    throw new SchedulingError(StatusCodes.NOT_FOUND, 'Appointment participants not found');
  }

  const canAccess =
    user.role === 'admin' ||
    (user.role === 'doctor' && doctor.user_id?.toString() === user.sub) ||
    (user.role === 'patient' && patient.user_id?.toString() === user.sub);

  if (!canAccess) {
    throw new SchedulingError(StatusCodes.FORBIDDEN, 'Forbidden');
  }

  return {
    appointment,
    slot,
    doctorName: doctor.name,
    patientName: patient.full_name,
  };
}

export async function listDoctorAvailabilityForUser(
  userId: string,
): Promise<{ items: SchedulingAvailabilityResponse[] }> {
  const doctor = await requireDoctorForUser(userId);
  const items = await DoctorAvailability.find({ doctor_id: doctor._id }).sort({
    weekday: 1,
    start_time: 1,
  });

  return {
    items: items.map(mapAvailability),
  };
}

export async function createDoctorAvailabilityForUser(
  userId: string,
  input: AvailabilityInput,
): Promise<SchedulingAvailabilityResponse> {
  const doctor = await requireDoctorForUser(userId);
  await ensureAvailabilityPayloadIsValid(doctor._id, input);

  const availability = await DoctorAvailability.create({
    doctor_id: doctor._id,
    weekday: input.weekday,
    start_time: input.start_time,
    end_time: input.end_time,
    slot_duration_minutes: input.slot_duration_minutes,
    break_start_time: input.break_start_time ?? null,
    break_end_time: input.break_end_time ?? null,
    is_active: input.is_active ?? true,
  });

  console.info(
    `[scheduling] availability created doctor=${doctor.id} availability=${availability.id}`,
  );

  return mapAvailability(availability);
}

export async function updateDoctorAvailabilityForUser(
  userId: string,
  availabilityId: string,
  input: AvailabilityInput,
): Promise<SchedulingAvailabilityResponse> {
  const doctor = await requireDoctorForUser(userId);

  if (!mongoose.isValidObjectId(availabilityId)) {
    throw new SchedulingError(StatusCodes.NOT_FOUND, 'Availability not found');
  }

  const availability = await DoctorAvailability.findOne({
    _id: toObjectId(availabilityId),
    doctor_id: doctor._id,
  });

  if (!availability) {
    throw new SchedulingError(StatusCodes.NOT_FOUND, 'Availability not found');
  }

  await ensureAvailabilityPayloadIsValid(doctor._id, input, availabilityId);

  availability.weekday = input.weekday;
  availability.start_time = input.start_time;
  availability.end_time = input.end_time;
  availability.slot_duration_minutes = input.slot_duration_minutes;
  availability.break_start_time = input.break_start_time ?? null;
  availability.break_end_time = input.break_end_time ?? null;
  availability.is_active = input.is_active ?? true;
  await availability.save();

  await AppointmentSlot.deleteMany({
    availability_id: availability._id,
    status: 'available',
    start_datetime: { $gte: new Date() },
  });

  console.info(
    `[scheduling] availability updated doctor=${doctor.id} availability=${availability.id}`,
  );

  return mapAvailability(availability);
}

export async function deleteDoctorAvailabilityForUser(
  userId: string,
  availabilityId: string,
): Promise<void> {
  const doctor = await requireDoctorForUser(userId);

  if (!mongoose.isValidObjectId(availabilityId)) {
    throw new SchedulingError(StatusCodes.NOT_FOUND, 'Availability not found');
  }

  const availability = await DoctorAvailability.findOne({
    _id: toObjectId(availabilityId),
    doctor_id: doctor._id,
  });

  if (!availability) {
    throw new SchedulingError(StatusCodes.NOT_FOUND, 'Availability not found');
  }

  await AppointmentSlot.deleteMany({
    availability_id: availability._id,
    status: 'available',
    start_datetime: { $gte: new Date() },
  });
  await availability.deleteOne();

  console.info(
    `[scheduling] availability deleted doctor=${doctor.id} availability=${availability.id}`,
  );
}

export async function generateSlotsForDoctorUser(
  userId: string,
  input: GenerateSlotsInput,
): Promise<{
  generated_count: number;
  skipped_count: number;
  start_date: string;
  days_ahead: number;
}> {
  const doctor = await requireDoctorForUser(userId);
  const availabilities = await DoctorAvailability.find({
    doctor_id: doctor._id,
    is_active: true,
  });

  if (availabilities.length === 0) {
    throw new SchedulingError(
      StatusCodes.CONFLICT,
      'Create at least one active availability before generating slots',
    );
  }

  const startDate =
    input.start_date && /^\d{4}-\d{2}-\d{2}$/.test(input.start_date)
      ? startOfDay(new Date(`${input.start_date}T00:00:00`))
      : startOfDay(new Date());

  const daysAhead = resolveSchedulingHorizonDays(input.days_ahead, startDate);

  const now = new Date();
  const operations: mongoose.AnyBulkWriteOperation<AppointmentSlotDocument>[] = [];
  let totalCandidates = 0;

  for (let offset = 0; offset < daysAhead; offset += 1) {
    const date = addDays(startDate, offset);
    const weekday = weekdayValues[date.getDay()];
    const dayAvailabilities = availabilities.filter(
      (availability) => availability.weekday === weekday,
    );

    for (const availability of dayAvailabilities) {
      const slotCandidates = buildSlotCandidates(availability, date, now);
      totalCandidates += slotCandidates.length;

      for (const slot of slotCandidates) {
        operations.push({
          updateOne: {
            filter: {
              doctor_id: doctor._id,
              start_datetime: slot.startDatetime,
            },
            update: {
              $setOnInsert: {
                doctor_id: doctor._id,
                availability_id: availability._id,
                slot_date: slot.slotDate,
                start_datetime: slot.startDatetime,
                end_datetime: slot.endDatetime,
                status: 'available',
                created_at: new Date(),
                updated_at: new Date(),
              },
            },
            upsert: true,
          },
        });
      }
    }
  }

  const result =
    operations.length > 0
      ? await AppointmentSlot.bulkWrite(operations, { ordered: false })
      : null;

  const generatedCount = normalizeBulkWriteUpsertCount(result);

  if (totalCandidates === 0 && availabilities.length > 0) {
    console.warn(
      `[scheduling] zero slot candidates doctor=${doctor.id} daysAhead=${daysAhead} availabilities=${availabilities.length} — check weekday vs date range, window size vs slot duration + gap, breaks, or all times in the past`,
    );
  }

  console.info(
    `[scheduling] slots generated doctor=${doctor.id} generated=${generatedCount} candidates=${totalCandidates}`,
  );

  return {
    generated_count: generatedCount,
    skipped_count: totalCandidates - generatedCount,
    start_date: dateOnlyString(startDate),
    days_ahead: daysAhead,
  };
}

export async function listDoctorSlotsForUser(
  userId: string,
  input?: { days_ahead?: number; status?: SchedulingSlotResponse['status'] },
): Promise<{ items: SchedulingSlotResponse[] }> {
  const doctor = await requireDoctorForUser(userId);
  const rangeStart = startOfDay(new Date());
  const daysAhead = resolveSchedulingHorizonDays(input?.days_ahead, rangeStart);
  const until = addDays(rangeStart, daysAhead + 1);
  const filter: {
    doctor_id: mongoose.Types.ObjectId;
    start_datetime: { $gte: Date; $lt: Date };
    status?: SchedulingSlotResponse['status'];
  } = {
    doctor_id: doctor._id,
    start_datetime: { $gte: new Date(), $lt: until },
  };

  if (input?.status) {
    filter.status = input.status;
  }

  const slots = await AppointmentSlot.find(filter).sort({ start_datetime: 1 });

  const appointmentContexts = await Promise.all(
    slots.map((slot) => loadSlotContext(slot._id)),
  );

  return {
    items: slots.map((slot, index) =>
      mapSlot(slot, {
        appointment: appointmentContexts[index].appointment,
        patientName: appointmentContexts[index].patientName,
        doctorName: doctor.name,
      }),
    ),
  };
}

export async function blockDoctorSlotForUser(
  userId: string,
  slotId: string,
): Promise<SchedulingSlotResponse> {
  const doctor = await requireDoctorForUser(userId);

  if (!mongoose.isValidObjectId(slotId)) {
    throw new SchedulingError(StatusCodes.NOT_FOUND, 'Slot not found');
  }

  const slot = await AppointmentSlot.findOne({
    _id: toObjectId(slotId),
    doctor_id: doctor._id,
  });

  if (!slot) {
    throw new SchedulingError(StatusCodes.NOT_FOUND, 'Slot not found');
  }

  if (slot.start_datetime <= new Date()) {
    throw new SchedulingError(
      StatusCodes.CONFLICT,
      'Only future slots can be blocked',
    );
  }

  if (slot.status !== 'available') {
    throw new SchedulingError(
      StatusCodes.CONFLICT,
      'Only available slots can be blocked',
    );
  }

  slot.status = 'blocked';
  await slot.save();

  console.info(`[scheduling] slot blocked doctor=${doctor.id} slot=${slot.id}`);

  return mapSlot(slot, { doctorName: doctor.name });
}

export async function listPatientVisibleSlots(
  userId: string,
  input: SlotListInput,
): Promise<{
  doctor: { id: string; name: string; specialization: string };
  items: SchedulingSlotResponse[];
}> {
  await requirePatientForUser(userId);

  if (!mongoose.isValidObjectId(input.doctor_id)) {
    throw new SchedulingError(StatusCodes.NOT_FOUND, 'Doctor not found');
  }

  const doctor = await Doctor.findById(input.doctor_id);
  if (!doctor) {
    throw new SchedulingError(StatusCodes.NOT_FOUND, 'Doctor not found');
  }

  const rangeStart = startOfDay(new Date());
  const daysAhead = resolveSchedulingHorizonDays(input.days_ahead, rangeStart);
  const until = addDays(rangeStart, daysAhead + 1);

  const slots = await AppointmentSlot.find({
    doctor_id: doctor._id,
    status: input.status ?? 'available',
    start_datetime: { $gt: new Date(), $lt: until },
  }).sort({ start_datetime: 1 });

  return {
    doctor: {
      id: doctor.id,
      name: doctor.name,
      specialization: doctor.specialization,
    },
    items: slots.map((slot) => mapSlot(slot, { doctorName: doctor.name })),
  };
}

export async function bookAppointmentForPatientUser(
  userId: string,
  input: BookAppointmentInput,
): Promise<SchedulingAppointmentResponse> {
  const patient = await requirePatientForUser(userId);

  if (!mongoose.isValidObjectId(input.slot_id)) {
    throw new SchedulingError(StatusCodes.NOT_FOUND, 'Slot not found');
  }

  const now = new Date();
  const slot = await AppointmentSlot.findOneAndUpdate(
    {
      _id: toObjectId(input.slot_id),
      status: 'available',
      start_datetime: { $gt: now },
    },
    {
      $set: {
        status: 'booked',
        updated_at: now,
      },
    },
    { new: true },
  );

  if (!slot) {
    const existingSlot = await AppointmentSlot.findById(input.slot_id);
    if (!existingSlot) {
      throw new SchedulingError(StatusCodes.NOT_FOUND, 'Slot not found');
    }

    console.warn(
      `[scheduling] invalid booking attempt patient=${patient.id} slot=${input.slot_id} status=${existingSlot.status}`,
    );

    if (existingSlot.start_datetime <= now) {
      throw new SchedulingError(
        StatusCodes.CONFLICT,
        'Only future slots can be booked',
      );
    }

    throw new SchedulingError(
      StatusCodes.CONFLICT,
      'This slot is no longer available',
    );
  }

  try {
    const [appointment, doctor] = await Promise.all([
      ScheduledAppointment.create({
        slot_id: slot._id,
        doctor_id: slot.doctor_id,
        patient_id: patient._id,
        status: 'booked',
        reason_for_visit: input.reason_for_visit?.trim() ?? '',
        patient_note: input.patient_note?.trim() || undefined,
        booked_at: now,
      }),
      Doctor.findById(slot.doctor_id),
    ]);

    if (!doctor) {
      throw new SchedulingError(StatusCodes.NOT_FOUND, 'Doctor not found');
    }

    console.info(
      `[scheduling] appointment booked appointment=${appointment.id} slot=${slot.id} doctor=${doctor.id} patient=${patient.id}`,
    );

    return mapAppointment(
      appointment,
      slot,
      doctor.name,
      patient.full_name,
      'patient',
    );
  } catch (error) {
    await AppointmentSlot.updateOne(
      { _id: slot._id, status: 'booked' },
      {
        $set: {
          status: 'available',
          updated_at: new Date(),
        },
      },
    );

    if (isDuplicateKeyError(error)) {
      throw new SchedulingError(
        StatusCodes.CONFLICT,
        'This slot was already booked',
      );
    }

    throw error;
  }
}

export async function listDoctorAppointmentsForUser(
  userId: string,
  input?: AppointmentListInput,
): Promise<{ items: SchedulingAppointmentResponse[] }> {
  const doctor = await requireDoctorForUser(userId);
  const appointments = await ScheduledAppointment.find({
    doctor_id: doctor._id,
    ...(input?.status ? { status: input.status } : {}),
  })
    .sort({ booked_at: -1 })
    .limit(input?.limit ?? 50);

  const slotMap = await loadSlotsAndAppointments(appointments);
  const { patientNames } = await loadNamesForAppointments(appointments);

  const visibleAppointments = appointments
    .filter((appointment) => {
      const slot = slotMap.get(appointment.slot_id.toString());
      return Boolean(slot && slot.start_datetime >= new Date());
    })
    .sort((first, second) => {
      const firstSlot = slotMap.get(first.slot_id.toString());
      const secondSlot = slotMap.get(second.slot_id.toString());
      return (
        (firstSlot?.start_datetime.getTime() ?? 0) -
        (secondSlot?.start_datetime.getTime() ?? 0)
      );
    });

  return {
    items: visibleAppointments.map((appointment) =>
      mapAppointment(
        appointment,
        slotMap.get(appointment.slot_id.toString()) ?? null,
        doctor.name,
        patientNames.get(appointment.patient_id.toString()) ?? null,
        'doctor',
      ),
    ),
  };
}

export async function listPatientAppointmentsForUser(
  userId: string,
  input?: AppointmentListInput,
): Promise<{ items: SchedulingAppointmentResponse[] }> {
  const patient = await requirePatientForUser(userId);
  const appointments = await ScheduledAppointment.find({
    patient_id: patient._id,
    ...(input?.status ? { status: input.status } : {}),
  })
    .sort({ booked_at: -1 })
    .limit(input?.limit ?? 50);

  const slotMap = await loadSlotsAndAppointments(appointments);
  const { doctorNames } = await loadNamesForAppointments(appointments);

  const visibleAppointments = appointments
    .filter((appointment) => {
      const slot = slotMap.get(appointment.slot_id.toString());
      return Boolean(slot && slot.start_datetime >= new Date());
    })
    .sort((first, second) => {
      const firstSlot = slotMap.get(first.slot_id.toString());
      const secondSlot = slotMap.get(second.slot_id.toString());
      return (
        (firstSlot?.start_datetime.getTime() ?? 0) -
        (secondSlot?.start_datetime.getTime() ?? 0)
      );
    });

  return {
    items: visibleAppointments.map((appointment) =>
      mapAppointment(
        appointment,
        slotMap.get(appointment.slot_id.toString()) ?? null,
        doctorNames.get(appointment.doctor_id.toString()) ?? null,
        patient.full_name,
        'patient',
      ),
    ),
  };
}

export async function getAppointmentForUser(
  user: JwtPayload,
  appointmentId: string,
): Promise<SchedulingAppointmentResponse> {
  const accessible = await getAccessibleAppointment(user, appointmentId);
  return mapAppointment(
    accessible.appointment,
    accessible.slot,
    accessible.doctorName,
    accessible.patientName,
    user.role,
  );
}

export async function cancelAppointmentForUser(
  user: JwtPayload,
  appointmentId: string,
): Promise<SchedulingAppointmentResponse> {
  const { appointment, slot, doctorName, patientName } = await getAccessibleAppointment(
    user,
    appointmentId,
  );

  if (appointment.status !== 'booked') {
    throw new SchedulingError(
      StatusCodes.CONFLICT,
      'Only booked appointments can be cancelled',
    );
  }

  if (slot.start_datetime <= new Date()) {
    throw new SchedulingError(
      StatusCodes.CONFLICT,
      'Only future appointments can be cancelled',
    );
  }

  appointment.status = 'cancelled';
  appointment.cancelled_at = new Date();
  await appointment.save();

  slot.status = 'cancelled';
  await slot.save();

  console.info(
    `[scheduling] appointment cancelled appointment=${appointment.id} by_role=${user.role}`,
  );

  return mapAppointment(appointment, slot, doctorName, patientName, user.role);
}

export async function completeAppointmentForDoctorUser(
  userId: string,
  appointmentId: string,
  input?: AppointmentUpdateInput,
): Promise<SchedulingAppointmentResponse> {
  const doctor = await requireDoctorForUser(userId);
  const { appointment, slot, patientName } = await getAccessibleAppointment(
    {
      sub: userId,
      email: '',
      role: 'doctor',
    },
    appointmentId,
  );

  if (appointment.doctor_id.toString() !== doctor.id) {
    throw new SchedulingError(StatusCodes.FORBIDDEN, 'Forbidden');
  }

  if (appointment.status !== 'booked') {
    throw new SchedulingError(
      StatusCodes.CONFLICT,
      'Only booked appointments can be completed',
    );
  }

  appointment.status = 'completed';
  if (input?.doctor_note !== undefined) {
    appointment.doctor_note = input.doctor_note.trim() || undefined;
  }
  await appointment.save();

  slot.status = 'completed';
  await slot.save();

  console.info(
    `[scheduling] appointment completed appointment=${appointment.id} doctor=${doctor.id}`,
  );

  return mapAppointment(appointment, slot, doctor.name, patientName, 'doctor');
}
