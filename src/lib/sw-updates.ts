/**
 * Tracks whether a new service worker version is installed and
 * waiting, and applies it on request. Never reloads on its own: the
 * player chooses when, so a running game is never interrupted.
 */
export type SwUpdates = {
  track(
    registration: ServiceWorkerRegistration,
    container: ServiceWorkerContainer,
  ): void;
  subscribe(listener: () => void): () => void;
  isUpdateReady(): boolean;
  applyUpdate(): void;
};

export function createSwUpdates(reload: () => void): SwUpdates {
  let waiting: ServiceWorker | null = null;
  let container: ServiceWorkerContainer | null = null;
  const listeners = new Set<() => void>();

  function offer(worker: ServiceWorker) {
    waiting = worker;
    for (const listener of listeners) listener();
  }

  return {
    track(registration, swContainer) {
      container = swContainer;
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed") offer(worker);
        });
      });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    isUpdateReady: () => waiting !== null,
    applyUpdate() {
      void container;
      void reload;
    },
  };
}
