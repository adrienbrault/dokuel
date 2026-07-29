// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { gameFeedback } from "./game-feedback.ts";

describe("gameFeedback", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exposes a method for each game event", () => {
    expect(typeof gameFeedback.onPlace).toBe("function");
    expect(typeof gameFeedback.onErase).toBe("function");
    expect(typeof gameFeedback.onToggleNotes).toBe("function");
    expect(typeof gameFeedback.onHint).toBe("function");
    expect(typeof gameFeedback.onConflict).toBe("function");
    expect(typeof gameFeedback.onComplete).toBe("function");
  });

  it("vibrates on user actions when navigator.vibrate is available", () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: vibrate,
    });

    gameFeedback.onPlace();
    gameFeedback.onErase();
    gameFeedback.onToggleNotes();
    gameFeedback.onHint();
    gameFeedback.onConflict();
    gameFeedback.onComplete();

    expect(vibrate).toHaveBeenCalledTimes(6);
  });
});
