let visibleUntilMs = 0;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {}
  });
}

export function triggerGlobalRefreshIndicator(minVisibleMs = 1200) {
  const nextUntil = Date.now() + Math.max(0, minVisibleMs);
  if (nextUntil > visibleUntilMs) {
    visibleUntilMs = nextUntil;
    notify();
  }
}

export function getGlobalRefreshIndicatorUntil() {
  return visibleUntilMs;
}

export function subscribeGlobalRefreshIndicator(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

