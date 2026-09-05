/**
 * Leading-and-trailing throttle for a stream of values where only the
 * newest one matters. The first value goes out at once so the reader
 * reacts immediately; anything that arrives while the window is open is
 * coalesced, and the last of them goes out when it closes. Nothing is
 * ever dropped silently: the final state always reaches the reader.
 *
 * Built for the multiplayer board silhouette, which is republished on
 * every filled cell and would otherwise become one presence broadcast
 * per keystroke.
 */

export type Throttled<T> = {
  (value: T): void;
  /** Drop a pending trailing send. Call this before tearing the reader down. */
  cancel(): void;
};

export function throttleTrailing<T>(
  send: (value: T) => void,
  waitMs: number,
): Throttled<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { value: T } | null = null;

  const closeWindow = () => {
    timer = null;
    if (pending === null) return;
    const { value } = pending;
    pending = null;
    // Re-open the window around the trailing send: it is a send like
    // any other, and a burst that never pauses must not turn into one
    // broadcast per call the moment the first window lapses.
    openWindow();
    send(value);
  };

  function openWindow() {
    timer = setTimeout(closeWindow, waitMs);
  }

  const throttled = (value: T) => {
    if (timer !== null) {
      pending = { value };
      return;
    }
    openWindow();
    send(value);
  };

  throttled.cancel = () => {
    pending = null;
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  };

  return throttled;
}
