type NotificationStateListener = () => void;

export const NOTIFICATION_CATEGORY_ID = 'healthsage-default-actions';
export const NOTIFICATION_ACTION_MARK_READ = 'mark_read';

export type NotificationRuntimeEvent = {
  kind: 'received' | 'response';
  notificationId: string | null;
  type: string | null;
  href: string | null;
  data: Record<string, unknown> | null;
};

const stateListeners = new Set<NotificationStateListener>();
const runtimeListeners = new Set<(event: NotificationRuntimeEvent) => void>();
let currentPathname = '';

const patientNotificationTypes = new Set([
  'doctor_assignment_request',
  'doctor_assignment_update',
]);

const reportNotificationTypes = new Set([
  'report_uploaded_by_patient',
  'report_uploaded_by_doctor',
  'generated_report_shared',
]);

const treatmentNotificationTypes = new Set([
  'prescription_created',
  'prescription_updated',
  'prescription_discontinued',
  'lifestyle_plan_created',
  'lifestyle_plan_updated',
  'lifestyle_plan_discontinued',
]);

function notifyStateListeners() {
  stateListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // ignore listener failures
    }
  });
}

export function subscribeNotificationState(listener: NotificationStateListener) {
  stateListeners.add(listener);
  return () => {
    stateListeners.delete(listener);
  };
}

export function emitNotificationStateChanged() {
  notifyStateListeners();
}

export function subscribeNotificationEvents(
  listener: (event: NotificationRuntimeEvent) => void,
) {
  runtimeListeners.add(listener);
  return () => {
    runtimeListeners.delete(listener);
  };
}

export function emitNotificationEvent(event: NotificationRuntimeEvent) {
  runtimeListeners.forEach((listener) => {
    try {
      listener(event);
    } catch {
      // ignore listener failures
    }
  });

  notifyStateListeners();
}

export function parseNotificationRuntimeEvent(input: {
  kind: 'received' | 'response';
  data?: unknown;
  fallbackId?: string | null;
}): NotificationRuntimeEvent {
  const rawData =
    input.data && typeof input.data === 'object' && !Array.isArray(input.data)
      ? (input.data as Record<string, unknown>)
      : null;

  return {
    kind: input.kind,
    notificationId:
      (typeof rawData?.id === 'string' && rawData.id) ||
      (typeof rawData?.notificationId === 'string' && rawData.notificationId) ||
      input.fallbackId ||
      null,
    type: typeof rawData?.type === 'string' ? rawData.type : null,
    href: typeof rawData?.href === 'string' ? rawData.href : null,
    data: rawData,
  };
}

export function isAppointmentNotificationType(type: unknown): boolean {
  return typeof type === 'string' && type.startsWith('appointment_');
}

export function isPatientNotificationType(type: unknown): boolean {
  return typeof type === 'string' && patientNotificationTypes.has(type);
}

export function isReportNotificationType(type: unknown): boolean {
  return typeof type === 'string' && reportNotificationTypes.has(type);
}

export function isTreatmentNotificationType(type: unknown): boolean {
  return typeof type === 'string' && treatmentNotificationTypes.has(type);
}

export function isDashboardRefreshNotificationType(type: unknown): boolean {
  return (
    isAppointmentNotificationType(type) ||
    isPatientNotificationType(type) ||
    isReportNotificationType(type) ||
    isTreatmentNotificationType(type)
  );
}

export function setNotificationCurrentPath(pathname: string) {
  currentPathname = pathname;
}

export function getNotificationCurrentPath() {
  return currentPathname;
}

export function shouldSuppressForegroundNotification(event: {
  type?: unknown;
  href?: unknown;
}) {
  if (currentPathname === '/appointments') {
    return isAppointmentNotificationType(event.type);
  }

  if (currentPathname === '/patients') {
    return isPatientNotificationType(event.type);
  }

  if (currentPathname === '/reports') {
    return isReportNotificationType(event.type);
  }

  if (currentPathname === '/doctor-treatment-plan') {
    return isTreatmentNotificationType(event.type);
  }

  return false;
}
