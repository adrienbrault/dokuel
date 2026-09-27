import { describe, expect, it, vi } from "vitest";
import { createAmbianceChannel } from "./ambiance.ts";

describe("ambiance channel", () => {
  it("delivers events to subscribers until they unsubscribe", () => {
    const channel = createAmbianceChannel();
    const listener = vi.fn();
    const unsubscribe = channel.subscribe(listener);

    channel.emit({ type: "place", row: 2, col: 5, digit: 7 });
    unsubscribe();
    channel.emit({ type: "victory" });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      type: "place",
      row: 2,
      col: 5,
      digit: 7,
    });
  });
});
