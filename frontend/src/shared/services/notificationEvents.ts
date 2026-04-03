const listeners = new Set<() => void>();

export function subscribeNotificationState(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitNotificationStateChanged() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // ignore listener failures
    }
  });
}
