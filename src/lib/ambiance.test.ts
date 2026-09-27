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

  it("remembers the current scene and board progress for a late subscriber", () => {
    const channel = createAmbianceChannel();
    expect(channel.getState()).toEqual({ scene: "menu", progress: 0 });

    channel.setScene("game");
    channel.setProgress(0.4);

    expect(channel.getState()).toEqual({ scene: "game", progress: 0.4 });
  });

  it("resets progress when the player leaves the board", () => {
    const channel = createAmbianceChannel();
    channel.setScene("game");
    channel.setProgress(0.9);

    channel.setScene("menu");

    expect(channel.getState().progress).toBe(0);
  });
});
