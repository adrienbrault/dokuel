import { describe, expect, it, vi } from "vitest";
import { createSwUpdates, registerServiceWorker } from "./sw-updates.ts";

// Minimal stand-ins for the browser's ServiceWorker objects: the
// container and registration are the system boundary here.
class FakeWorker extends EventTarget {
  state = "installing";
  postMessage = vi.fn();
  setState(state: string) {
    this.state = state;
    this.dispatchEvent(new Event("statechange"));
  }
}

class FakeRegistration extends EventTarget {
  installing: FakeWorker | null = null;
  waiting: FakeWorker | null = null;
  startInstall(): FakeWorker {
    const worker = new FakeWorker();
    this.installing = worker;
    this.dispatchEvent(new Event("updatefound"));
    return worker;
  }
}

class FakeContainer extends EventTarget {
  controller: object | null;
  constructor(controller: object | null) {
    super();
    this.controller = controller;
  }
}

function setup({ controlled }: { controlled: boolean }) {
  const reload = vi.fn();
  const updates = createSwUpdates(reload);
  const registration = new FakeRegistration();
  const container = new FakeContainer(controlled ? {} : null);
  const onChange = vi.fn();
  updates.subscribe(onChange);
  return { updates, registration, container, reload, onChange };
}

function track(s: ReturnType<typeof setup>) {
  s.updates.track(
    s.registration as unknown as ServiceWorkerRegistration,
    s.container as unknown as ServiceWorkerContainer,
  );
}

describe("createSwUpdates", () => {
  it("offers an update once a new version finishes installing", () => {
    const s = setup({ controlled: true });
    track(s);

    const worker = s.registration.startInstall();
    expect(s.updates.isUpdateReady()).toBe(false);
    worker.setState("installed");

    expect(s.updates.isUpdateReady()).toBe(true);
    expect(s.onChange).toHaveBeenCalled();
  });

  it("stays quiet on the very first install", () => {
    // No controller means this page ran without a worker: the first
    // version installing is not an update, just offline support.
    const s = setup({ controlled: false });
    track(s);

    s.registration.startInstall().setState("installed");

    expect(s.updates.isUpdateReady()).toBe(false);
  });

  it("offers a version that was already waiting from an earlier visit", () => {
    // The update downloaded last time but the tab was closed before
    // the player reloaded: it is still waiting on this page load.
    const s = setup({ controlled: true });
    s.registration.waiting = new FakeWorker();
    track(s);

    expect(s.updates.isUpdateReady()).toBe(true);
  });

  it("activates the waiting version and reloads once it takes control", () => {
    const s = setup({ controlled: true });
    const worker = new FakeWorker();
    s.registration.waiting = worker;
    track(s);

    s.updates.applyUpdate();
    expect(worker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    // Reloading before the swap would just load the old version again.
    expect(s.reload).not.toHaveBeenCalled();

    s.container.dispatchEvent(new Event("controllerchange"));
    expect(s.reload).toHaveBeenCalledTimes(1);
  });

  it("ignores a reload request when nothing is waiting", () => {
    const s = setup({ controlled: true });
    track(s);

    s.updates.applyUpdate();
    s.container.dispatchEvent(new Event("controllerchange"));

    expect(s.reload).not.toHaveBeenCalled();
  });

  it("stops notifying a listener once it unsubscribes", () => {
    // The toast unmounts when the player leaves a menu for a board.
    const s = setup({ controlled: true });
    const listener = vi.fn();
    const unsubscribe = s.updates.subscribe(listener);
    track(s);
    unsubscribe();

    s.registration.startInstall().setState("installed");

    expect(listener).not.toHaveBeenCalled();
  });

  it("never reloads for a controller change nobody asked for", () => {
    // clients.claim() on a first install also fires controllerchange;
    // that must not yank the page out from under a game.
    const s = setup({ controlled: false });
    track(s);

    s.container.dispatchEvent(new Event("controllerchange"));

    expect(s.reload).not.toHaveBeenCalled();
  });
});

describe("registerServiceWorker", () => {
  it("registers the built worker and watches it for updates", async () => {
    const registration = new FakeRegistration();
    registration.waiting = new FakeWorker();
    const container = Object.assign(new FakeContainer({}), {
      register: vi.fn(() => Promise.resolve(registration)),
    });
    const updates = createSwUpdates(vi.fn());

    await registerServiceWorker(
      container as unknown as ServiceWorkerContainer,
      updates,
    );

    expect(container.register).toHaveBeenCalledWith("/sw.js");
    expect(updates.isUpdateReady()).toBe(true);
  });

  it("shrugs off a failed registration", async () => {
    // Offline support is a bonus: a blocked or failing worker must
    // never break the app that is already running.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const container = Object.assign(new FakeContainer(null), {
      register: vi.fn(() => Promise.reject(new Error("blocked"))),
    });

    await registerServiceWorker(
      container as unknown as ServiceWorkerContainer,
      createSwUpdates(vi.fn()),
    );

    expect(warn).toHaveBeenCalled();
  });
});
