const path = require('path');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DEMO_PASSWORD = process.env.DEMO_SEED_PASSWORD || 'HealthSage123!';
const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

const doctorSeeds = [
  {
    key: 'ayesha',
    email: 'demo.doctor.ayesha@healthsage.test',
    display_name: 'Dr. Ayesha Malik',
    specialization: 'Endocrinology',
    phone: '+92-300-1111001',
    bio: 'Focuses on preventive diabetes care and long-term metabolic health.',
    accepting_patients: true,
  },
  {
    key: 'omar',
    email: 'demo.doctor.omar@healthsage.test',
    display_name: 'Dr. Omar Siddiqui',
    specialization: 'Internal Medicine',
    phone: '+92-300-1111002',
    bio: 'Manages complex adult cases with hypertension and lipid issues.',
    accepting_patients: true,
  },
  {
    key: 'sana',
    email: 'demo.doctor.sana@healthsage.test',
    display_name: 'Dr. Sana Qureshi',
    specialization: 'Diabetes Education',
    phone: '+92-300-1111003',
    bio: 'Supports lifestyle change, adherence, and coaching for chronic care.',
    accepting_patients: true,
  },
  {
    key: 'hamza',
    email: 'demo.doctor.hamza@healthsage.test',
    display_name: 'Dr. Hamza Farooq',
    specialization: 'Nephrology',
    phone: '+92-300-1111004',
    bio: 'Reviews renal risk and advanced metabolic complications.',
    accepting_patients: false,
  },
];

const patientSeeds = [
  {
    key: 'low',
    email: 'demo.patient.low@healthsage.test',
    display_name: 'Hina Rauf',
    patient_id: 'PT-DEMO-LOW',
    risk_category: 'low',
    probability: 0.08,
    predicted_label: 0,
    full_name: 'Hina Rauf',
    age: 29,
    sex: 'Female',
    height_cm: 164,
    weight_kg: 58,
    lab_tests: {
      hba1c: 5.1,
      fasting_glucose: 92,
      glucose: 96,
      cholesterol: 168,
      hdl: 58,
      ldl: 96,
      triglycerides: 82,
      urea: 24,
      creatinine: 0.8,
    },
    vital_signs: {
      bmi: 21.6,
      systolic_bp: 112,
      diastolic_bp: 72,
    },
    lifestyle: {
      smoking: 'Never',
      drinking: 'No',
      exercise: 'Regular',
    },
    conditions: ['Routine metabolic screening'],
    primary_doctor_key: 'ayesha',
  },
  {
    key: 'borderline',
    email: 'demo.patient.borderline@healthsage.test',
    display_name: 'Bilal Khan',
    patient_id: 'PT-DEMO-BORDER',
    risk_category: 'borderline',
    probability: 0.24,
    predicted_label: 0,
    full_name: 'Bilal Khan',
    age: 41,
    sex: 'Male',
    height_cm: 173,
    weight_kg: 79,
    lab_tests: {
      hba1c: 5.8,
      fasting_glucose: 104,
      glucose: 121,
      cholesterol: 198,
      hdl: 46,
      ldl: 124,
      triglycerides: 138,
      urea: 29,
      creatinine: 0.9,
    },
    vital_signs: {
      bmi: 26.4,
      systolic_bp: 124,
      diastolic_bp: 80,
    },
    lifestyle: {
      smoking: 'Former',
      drinking: 'Occasional',
      exercise: 'Light',
    },
    conditions: ['Prediabetes', 'Family history of diabetes'],
    primary_doctor_key: 'ayesha',
  },
  {
    key: 'moderate',
    email: 'demo.patient.moderate@healthsage.test',
    display_name: 'Nida Ahmed',
    patient_id: 'PT-DEMO-MODERATE',
    risk_category: 'moderate',
    probability: 0.46,
    predicted_label: 0,
    full_name: 'Nida Ahmed',
    age: 48,
    sex: 'Female',
    height_cm: 160,
    weight_kg: 76,
    lab_tests: {
      hba1c: 6.3,
      fasting_glucose: 118,
      glucose: 139,
      cholesterol: 214,
      hdl: 43,
      ldl: 137,
      triglycerides: 168,
      urea: 32,
      creatinine: 1.0,
    },
    vital_signs: {
      bmi: 29.7,
      systolic_bp: 132,
      diastolic_bp: 85,
    },
    lifestyle: {
      smoking: 'Never',
      drinking: 'No',
      exercise: 'Occasional',
    },
    conditions: ['Prediabetes', 'Dyslipidemia'],
    pending_doctor_key: 'sana',
  },
  {
    key: 'high',
    email: 'demo.patient.high@healthsage.test',
    display_name: 'Saad Iqbal',
    patient_id: 'PT-DEMO-HIGH',
    risk_category: 'high',
    probability: 0.71,
    predicted_label: 1,
    full_name: 'Saad Iqbal',
    age: 56,
    sex: 'Male',
    height_cm: 171,
    weight_kg: 93,
    lab_tests: {
      hba1c: 7.4,
      fasting_glucose: 148,
      glucose: 186,
      cholesterol: 232,
      hdl: 39,
      ldl: 151,
      triglycerides: 208,
      urea: 37,
      creatinine: 1.1,
    },
    vital_signs: {
      bmi: 31.8,
      systolic_bp: 145,
      diastolic_bp: 91,
    },
    lifestyle: {
      smoking: 'Current',
      drinking: 'Occasional',
      exercise: 'Rare',
    },
    conditions: ['Type 2 diabetes', 'Hypertension'],
    primary_doctor_user_email: 'r@gmail.com',
  },
  {
    key: 'critical',
    email: 'demo.patient.critical@healthsage.test',
    display_name: 'Mariam Ali',
    patient_id: 'PT-DEMO-CRITICAL',
    risk_category: 'critical',
    probability: 0.93,
    predicted_label: 1,
    full_name: 'Mariam Ali',
    age: 63,
    sex: 'Female',
    height_cm: 157,
    weight_kg: 88,
    lab_tests: {
      hba1c: 9.1,
      fasting_glucose: 182,
      glucose: 248,
      cholesterol: 256,
      hdl: 34,
      ldl: 171,
      triglycerides: 246,
      urea: 44,
      creatinine: 1.3,
    },
    vital_signs: {
      bmi: 35.7,
      systolic_bp: 156,
      diastolic_bp: 98,
    },
    lifestyle: {
      smoking: 'Former',
      drinking: 'No',
      exercise: 'None',
    },
    conditions: ['Type 2 diabetes', 'Chronic kidney disease risk', 'Hypertension'],
    primary_doctor_key: 'omar',
  },
];

function buildProfileCode(prefix, id) {
  return `${prefix}-${String(id).replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()}`;
}

function normalizeConditionCode(condition) {
  return condition.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function addDays(baseDate, days) {
  const next = new Date(baseDate);
  next.setDate(next.getDate() + days);
  return next;
}

function atTime(baseDate, hours, minutes) {
  return new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    hours,
    minutes,
    0,
    0,
  );
}

function dateOnlyString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function ensureUser(users, baseUser, hashedPassword) {
  const payload = {
    email: baseUser.email.toLowerCase(),
    display_name: baseUser.display_name,
    role: baseUser.role,
    avatar_url: null,
    disabled: false,
    hashed_password: hashedPassword,
    updated_at: new Date(),
  };

  const existing = await users.findOne({ email: payload.email });
  if (existing) {
    await users.updateOne(
      { _id: existing._id },
      {
        $set: payload,
        $setOnInsert: { created_at: new Date() },
      },
    );
    return users.findOne({ _id: existing._id });
  }

  const created = {
    ...payload,
    created_at: new Date(),
    last_login_at: null,
  };
  const result = await users.insertOne(created);
  return users.findOne({ _id: result.insertedId });
}

async function ensureDoctorProfile(doctors, user, seed) {
  const existing = await doctors.findOne({ user_id: user._id });
  const base = {
    user_id: user._id,
    doctor_id: existing?.doctor_id || buildProfileCode('DR', String(user._id)),
    name: seed.display_name,
    specialization: seed.specialization,
    email: user.email,
    phone: seed.phone,
    bio: seed.bio,
    accepting_patients: seed.accepting_patients,
    updated_at: new Date(),
  };

  if (existing) {
    await doctors.updateOne({ _id: existing._id }, { $set: base });
    return doctors.findOne({ _id: existing._id });
  }

  const result = await doctors.insertOne({
    ...base,
    created_at: new Date(),
  });
  return doctors.findOne({ _id: result.insertedId });
}

async function ensurePatientProfile(patients, user, seed, primaryDoctorId) {
  const existing = await patients.findOne({ user_id: user._id });
  const base = {
    user_id: user._id,
    patient_id: seed.patient_id,
    full_name: seed.full_name,
    age: seed.age,
    sex: seed.sex,
    height_cm: seed.height_cm,
    weight_kg: seed.weight_kg,
    lab_tests: seed.lab_tests,
    vital_signs: seed.vital_signs,
    lifestyle: seed.lifestyle,
    conditions: seed.conditions,
    primary_doctor_id: primaryDoctorId || null,
    primary_doctor_assigned_at: primaryDoctorId ? new Date() : null,
    updated_at: new Date(),
  };

  if (existing) {
    await patients.updateOne({ _id: existing._id }, { $set: base });
    return patients.findOne({ _id: existing._id });
  }

  const result = await patients.insertOne({
    ...base,
    created_at: new Date(),
    neo4j_synced_at: null,
  });
  return patients.findOne({ _id: result.insertedId });
}

async function syncPatientObservations(observations, patient, seed) {
  const now = new Date();
  const entries = [
    ['HBA1C', seed.lab_tests.hba1c, '%'],
    ['FASTING_GLUCOSE', seed.lab_tests.fasting_glucose, 'mg/dL'],
    ['RANDOM_GLUCOSE', seed.lab_tests.glucose, 'mg/dL'],
    ['TOTAL_CHOLESTEROL', seed.lab_tests.cholesterol, 'mg/dL'],
    ['HDL', seed.lab_tests.hdl, 'mg/dL'],
    ['LDL', seed.lab_tests.ldl, 'mg/dL'],
    ['TRIGLYCERIDES', seed.lab_tests.triglycerides, 'mg/dL'],
    ['UREA', seed.lab_tests.urea, 'mg/dL'],
    ['CREATININE', seed.lab_tests.creatinine, 'mg/dL'],
    ['BMI', seed.vital_signs.bmi, 'kg/m2'],
    ['SYSTOLIC_BP', seed.vital_signs.systolic_bp, 'mmHg'],
    ['DIASTOLIC_BP', seed.vital_signs.diastolic_bp, 'mmHg'],
    ['BLOOD_PRESSURE_SYSTOLIC', seed.vital_signs.systolic_bp, 'mmHg'],
    ['BLOOD_PRESSURE_DIASTOLIC', seed.vital_signs.diastolic_bp, 'mmHg'],
    ['DIABETES_LABEL', seed.predicted_label, null],
  ];

  await Promise.all(
    entries.map(([code, value, unit]) =>
      observations.updateOne(
        { patient_id: patient._id, observation_code: code },
        {
          $set: {
            patient_id: patient._id,
            observation_code: code,
            value_numeric: value,
            unit,
            effective_at: now,
          },
          $setOnInsert: {
            created_at: now,
            neo4j_synced_at: null,
          },
        },
        { upsert: true },
      ),
    ),
  );
}

async function syncPatientConditions(conditionsCollection, patient, seed) {
  await conditionsCollection.deleteMany({ patient_id: patient._id });
  if (!seed.conditions.length) {
    return;
  }

  await conditionsCollection.insertMany(
    seed.conditions.map((condition) => ({
      patient_id: patient._id,
      code: normalizeConditionCode(condition),
      display_name: condition,
      status: 'active',
      created_at: new Date(),
      neo4j_synced_at: null,
    })),
  );
}

async function syncRiskPrediction(riskPredictions, patient, seed) {
  await riskPredictions.deleteMany({
    patient_id: patient._id,
    model_name: 'seeded_clinical_baseline',
  });

  await riskPredictions.insertOne({
    patient_id: patient._id,
    model_name: 'seeded_clinical_baseline',
    probability: seed.probability,
    predicted_label: seed.predicted_label,
    explanation: {
      category: seed.risk_category,
      seeded: true,
      summary: `Demo ${seed.risk_category} risk profile for testing.`,
    },
    created_at: new Date(),
  });
}

async function syncAssignmentRequest(requests, patient, patientUserId, pendingDoctorId) {
  await requests.updateMany(
    { patient_id: patient._id, status: 'pending' },
    {
      $set: {
        status: 'cancelled',
        responded_at: new Date(),
        updated_at: new Date(),
      },
    },
  );

  if (!pendingDoctorId) {
    return null;
  }

  const existing = await requests.findOne({
    patient_id: patient._id,
    doctor_id: pendingDoctorId,
    status: 'pending',
  });

  if (existing) {
    await requests.updateOne(
      { _id: existing._id },
      {
        $set: {
          note: 'Seeded pending doctor assignment request for demo testing',
          requested_by_user_id: patientUserId,
          updated_at: new Date(),
        },
      },
    );
    return requests.findOne({ _id: existing._id });
  }

  const result = await requests.insertOne({
    patient_id: patient._id,
    doctor_id: pendingDoctorId,
    requested_by_user_id: patientUserId,
    status: 'pending',
    note: 'Seeded pending doctor assignment request for demo testing',
    responded_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  });
  return requests.findOne({ _id: result.insertedId });
}

async function ensureAvailability(availabilities, doctorId, weekday, startTime, endTime, slotDurationMinutes) {
  const existing = await availabilities.findOne({
    doctor_id: doctorId,
    weekday,
    start_time: startTime,
    end_time: endTime,
  });

  const payload = {
    doctor_id: doctorId,
    weekday,
    start_time: startTime,
    end_time: endTime,
    slot_duration_minutes: slotDurationMinutes,
    break_start_time: null,
    break_end_time: null,
    is_active: true,
    updated_at: new Date(),
  };

  if (existing) {
    await availabilities.updateOne({ _id: existing._id }, { $set: payload });
    return availabilities.findOne({ _id: existing._id });
  }

  const result = await availabilities.insertOne({
    ...payload,
    created_at: new Date(),
  });
  return availabilities.findOne({ _id: result.insertedId });
}

async function ensureSlot(slots, doctorId, availabilityId, startDatetime, endDatetime, status) {
  const existing = await slots.findOne({
    doctor_id: doctorId,
    start_datetime: startDatetime,
  });

  const payload = {
    doctor_id: doctorId,
    availability_id: availabilityId || null,
    slot_date: dateOnlyString(startDatetime),
    start_datetime: startDatetime,
    end_datetime: endDatetime,
    status,
    updated_at: new Date(),
  };

  if (existing) {
    await slots.updateOne({ _id: existing._id }, { $set: payload });
    return slots.findOne({ _id: existing._id });
  }

  const result = await slots.insertOne({
    ...payload,
    created_at: new Date(),
  });
  return slots.findOne({ _id: result.insertedId });
}

async function ensureBookedAppointment(scheduledAppointments, slot, doctorId, patientId, reason, patientNote) {
  const existing = await scheduledAppointments.findOne({ slot_id: slot._id });
  const payload = {
    slot_id: slot._id,
    doctor_id: doctorId,
    patient_id: patientId,
    status: 'booked',
    reason_for_visit: reason,
    patient_note: patientNote,
    doctor_note: null,
    booked_at: new Date(),
    cancelled_at: null,
    updated_at: new Date(),
  };

  if (existing) {
    await scheduledAppointments.updateOne({ _id: existing._id }, { $set: payload });
    return scheduledAppointments.findOne({ _id: existing._id });
  }

  const result = await scheduledAppointments.insertOne({
    ...payload,
    created_at: new Date(),
  });
  return scheduledAppointments.findOne({ _id: result.insertedId });
}

async function seedDoctorSchedules(db, doctorDocs, patientDocsByKey) {
  const availabilities = db.collection('doctor_availabilities');
  const slots = db.collection('appointment_slots');
  const scheduledAppointments = db.collection('scheduled_appointments');
  const now = new Date();

  for (const doctor of doctorDocs) {
    if (!doctor.accepting_patients) {
      continue;
    }

    const seedDates = [1, 3, 5].map((offset) => addDays(now, offset));
    const availabilityByWeekday = new Map();

    for (const date of seedDates) {
      const weekday = WEEKDAYS[date.getDay()];
      if (!availabilityByWeekday.has(weekday)) {
        const availability = await ensureAvailability(
          availabilities,
          doctor._id,
          weekday,
          '09:00',
          '12:30',
          40,
        );
        availabilityByWeekday.set(weekday, availability);
      }
    }

    for (const date of seedDates) {
      const weekday = WEEKDAYS[date.getDay()];
      const availability = availabilityByWeekday.get(weekday) || null;
      const slotTimes = [
        [9, 0],
        [10, 0],
        [11, 10],
      ];

      for (const [hours, minutes] of slotTimes) {
        const startDatetime = atTime(date, hours, minutes);
        const endDatetime = new Date(startDatetime.getTime() + 40 * 60 * 1000);
        await ensureSlot(
          slots,
          doctor._id,
          availability?._id || null,
          startDatetime,
          endDatetime,
          'available',
        );
      }
    }
  }

  const bookedPairs = [
    {
      patientKey: 'low',
      slotOffsetDays: 1,
      slotTime: [9, 0],
      reason: 'Quarterly diabetes follow-up',
      note: 'Seeded booked appointment for low risk patient.',
    },
    {
      patientKey: 'critical',
      slotOffsetDays: 3,
      slotTime: [10, 0],
      reason: 'Urgent medication review',
      note: 'Seeded booked appointment for critical risk patient.',
    },
  ];

  for (const pair of bookedPairs) {
    const patient = patientDocsByKey.get(pair.patientKey);
    if (!patient || !patient.primary_doctor_id) {
      continue;
    }

    const slotStart = atTime(addDays(now, pair.slotOffsetDays), pair.slotTime[0], pair.slotTime[1]);
    const slotEnd = new Date(slotStart.getTime() + 40 * 60 * 1000);
    const slot = await ensureSlot(
      slots,
      patient.primary_doctor_id,
      null,
      slotStart,
      slotEnd,
      'booked',
    );

    await ensureBookedAppointment(
      scheduledAppointments,
      slot,
      patient.primary_doctor_id,
      patient._id,
      pair.reason,
      pair.note,
    );
  }
}

async function main() {
  if (!process.env.MONGO_URI || !process.env.MONGO_DB_NAME) {
    throw new Error('MONGO_URI and MONGO_DB_NAME must be set in express-backend/.env');
  }

  await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.MONGO_DB_NAME,
    serverSelectionTimeoutMS: 8000,
  });

  const db = mongoose.connection.db;
  const users = db.collection('users');
  const doctors = db.collection('doctors');
  const patients = db.collection('patients');
  const observations = db.collection('observations');
  const conditions = db.collection('conditions');
  const riskPredictions = db.collection('risk_predictions');
  const requests = db.collection('doctor_assignment_requests');

  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 12);
  const doctorDocsByKey = new Map();
  const demoDoctorUsers = [];

  for (const seed of doctorSeeds) {
    const user = await ensureUser(
      users,
      {
        email: seed.email,
        display_name: seed.display_name,
        role: 'doctor',
      },
      hashedPassword,
    );
    const doctor = await ensureDoctorProfile(doctors, user, seed);
    doctorDocsByKey.set(seed.key, doctor);
    demoDoctorUsers.push(user);
  }

  const existingRayyanUser = await users.findOne({ email: 'r@gmail.com', role: 'doctor' });
  let existingRayyanDoctor = null;
  if (existingRayyanUser) {
    existingRayyanDoctor = await doctors.findOne({ user_id: existingRayyanUser._id });
  }

  const patientDocsByKey = new Map();
  const demoPatientUsers = [];

  for (const seed of patientSeeds) {
    const user = await ensureUser(
      users,
      {
        email: seed.email,
        display_name: seed.display_name,
        role: 'patient',
      },
      hashedPassword,
    );

    let primaryDoctorId = null;
    if (seed.primary_doctor_key && doctorDocsByKey.has(seed.primary_doctor_key)) {
      primaryDoctorId = doctorDocsByKey.get(seed.primary_doctor_key)._id;
    } else if (seed.primary_doctor_user_email === 'r@gmail.com' && existingRayyanDoctor) {
      primaryDoctorId = existingRayyanDoctor._id;
    }

    const patient = await ensurePatientProfile(patients, user, seed, primaryDoctorId);
    await syncPatientObservations(observations, patient, seed);
    await syncPatientConditions(conditions, patient, seed);
    await syncRiskPrediction(riskPredictions, patient, seed);

    let pendingDoctorId = null;
    if (seed.pending_doctor_key && doctorDocsByKey.has(seed.pending_doctor_key)) {
      pendingDoctorId = doctorDocsByKey.get(seed.pending_doctor_key)._id;
    }
    await syncAssignmentRequest(requests, patient, user._id, pendingDoctorId);

    patientDocsByKey.set(seed.key, await patients.findOne({ _id: patient._id }));
    demoPatientUsers.push(user);
  }

  const scheduleDoctors = await doctors
    .find({ accepting_patients: true })
    .toArray();
  await seedDoctorSchedules(db, scheduleDoctors, patientDocsByKey);

  console.log('Seeded testing environment successfully.');
  console.log(`Mongo DB: ${process.env.MONGO_DB_NAME}`);
  console.log(`Demo password for seeded users: ${DEMO_PASSWORD}`);
  console.log('Doctors:');
  doctorSeeds.forEach((seed) => {
    console.log(`  - ${seed.display_name} (${seed.email})`);
  });
  console.log('Patients:');
  patientSeeds.forEach((seed) => {
    console.log(
      `  - ${seed.full_name} [${seed.risk_category}] (${seed.email})`,
    );
  });
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
