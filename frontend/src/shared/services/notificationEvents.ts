type NotificationStateListener = () => void;

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
      (typeof rawData?.id === 'string' && rawData.id) || input.fallbackId || null,
    type: typeof rawData?.type === 'string' ? rawData.type : null,
    href: typeof rawData?.href === 'string' ? rawData.href : null,
    data: rawData,
  };
}

export function isAppointmentNotificationType(type: unknown): boolean {
  return typeof type === 'string' && type.startsWith('appointment_');
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
  if (!isAppointmentNotificationType(event.type)) {
    return false;
  }

  return currentPathname === '/appointments';
}
