import { afterEach, describe, expect, it, vi } from "vitest";
import { throttleTrailing } from "./throttle.ts";

afterEach(() => {
  vi.useRealTimers();
});

describe("throttleTrailing", () => {
  it("passes the first value through immediately", () => {
    vi.useFakeTimers();
    const sent: string[] = [];
    const publish = throttleTrailing((v: string) => sent.push(v), 250);

    publish("a");

    expect(sent).toEqual(["a"]);
  });

  it("coalesces a burst into one trailing send of the final value", () => {
    // A fast solver fills a cell every few tens of ms; every keystroke
    // must not become a presence broadcast, but the silhouette the
    // opponent ends up looking at has to be the current one.
    vi.useFakeTimers();
    const sent: string[] = [];
    const publish = throttleTrailing((v: string) => sent.push(v), 250);

    publish("a");
    publish("b");
    publish("c");
    vi.advanceTimersByTime(250);

    expect(sent).toEqual(["a", "c"]);
  });

  it("sends nothing more when the window closes on no new value", () => {
    vi.useFakeTimers();
    const sent: string[] = [];
    const publish = throttleTrailing((v: string) => sent.push(v), 250);

    publish("a");
    vi.advanceTimersByTime(1000);

    expect(sent).toEqual(["a"]);
  });

  it("drops a pending send once cancelled", () => {
    // Unmount tears the connection down; a trailing publish afterwards
    // would announce onto a destroyed awareness.
    vi.useFakeTimers();
    const sent: string[] = [];
    const publish = throttleTrailing((v: string) => sent.push(v), 250);

    publish("a");
    publish("b");
    publish.cancel();
    vi.advanceTimersByTime(250);

    expect(sent).toEqual(["a"]);
  });
});
