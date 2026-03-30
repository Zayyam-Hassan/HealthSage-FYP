import type { Appointment } from '@/services/appointments';

/** Start instant for sorting / “upcoming” checks (best-effort from slot or display fields). */
export function getAppointmentStartMs(a: Appointment): number | null {
  if (a.slot?.start_datetime) {
    const t = new Date(a.slot.start_datetime).getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (a.display_date && a.display_time) {
    const parsed = Date.parse(`${a.display_date} ${a.display_time}`);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
}

/**
 * Saved / home lists: booked visits that are not cancelled and still in the future.
 * Does not show completed / no_show / cancelled.
 */
export function filterUpcomingBookedAppointments(items: Appointment[]): Appointment[] {
  const now = Date.now();
  const SLACK_MS = 60_000;
  return items.filter((a) => {
    if (a.status === 'cancelled') return false;
    if (a.status !== 'booked') return false;
    const t = getAppointmentStartMs(a);
    if (t == null) return false;
    return t >= now - SLACK_MS;
  });
}
