import { describe, expect, it, vi } from "vitest";
import { createSwUpdates } from "./sw-updates.ts";

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
});
