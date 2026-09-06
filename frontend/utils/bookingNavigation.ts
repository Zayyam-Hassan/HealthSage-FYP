import type { Router } from 'expo-router';
import type { AppDialogAction } from '@/src/shared/hooks/useAppDialog';
import { appointmentsService } from '@/services/appointments';

/** Same signature as `useAppDialog().showDialog` — use AppDialog instead of system Alert. */
export type BookingNotify = (
  title: string,
  message: string,
  actions?: AppDialogAction[],
) => void;

/**
 * Navigates to confirm-booking only when the doctor has at least one available slot.
 * @param notify - typically `showDialog` from `useAppDialog()`
 */
export async function navigateToConfirmBookingIfSlots(
  router: Router,
  doctorId: string,
  notify: BookingNotify,
): Promise<void> {
  try {
    const res = await appointmentsService.getDoctorPublicSlots(doctorId, { days_ahead: 31 });
    const hasSlot = res.items.some((s) => s.status === 'available');
    if (!hasSlot) {
      notify(
        'No slots available',
        'This doctor has no open appointments right now. Please try again later.',
      );
      return;
    }
    router.push({
      pathname: '/appointments/confirm-booking',
      params: { doctorId },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Please try again.';
    notify('Unable to load schedule', msg);
  }
}
