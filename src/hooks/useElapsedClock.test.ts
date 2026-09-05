import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useElapsedClock } from "./useElapsedClock.ts";

describe("useElapsedClock", () => {
  it("reads current elapsed time when its display interval is delayed", () => {
    let now = 1_000;
    const { result } = renderHook(() =>
      useElapsedClock({ running: true, now: () => now }),
    );

    now += 2_500.5;

    expect(result.current.getElapsedSeconds()).toBe(2.5005);
  });

  it("pauses and resumes without counting inactive time", () => {
    let now = 1_000;
    const { result, rerender } = renderHook(
      ({ running }: { running: boolean }) =>
        useElapsedClock({ running, now: () => now }),
      { initialProps: { running: true } },
    );

    now += 1_250.5;
    rerender({ running: false });
    expect(result.current.getElapsedSeconds()).toBe(1.2505);

    now += 10_000;
    rerender({ running: true });
    now += 749.75;
    act(() => result.current.finalize());

    expect(result.current.getElapsedSeconds()).toBe(2.00025);
  });

  it("resets authoritative elapsed time when the game key changes", () => {
    let now = 1_000;
    const { result, rerender } = renderHook(
      ({ gameKey }: { gameKey: string }) =>
        useElapsedClock({
          running: true,
          now: () => now,
          resetKey: gameKey,
        }),
      { initialProps: { gameKey: "game-1" } },
    );

    now += 2_500;
    expect(result.current.getElapsedSeconds()).toBe(2.5);

    rerender({ gameKey: "game-2" });
    expect(result.current.getElapsedSeconds()).toBe(0);
  });
});
