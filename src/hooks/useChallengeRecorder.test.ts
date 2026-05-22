import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useChallengeRecorder } from "./useChallengeRecorder.ts";

afterEach(() => {
  localStorage.clear();
});

describe("useChallengeRecorder", () => {
  it("starts with a single seed sample at the origin", () => {
    const { result } = renderHook(() =>
      useChallengeRecorder({
        completionPercent: 0,
        getTimerSeconds: () => 0,
        storageKey: "game-1",
      }),
    );
    expect(result.current.samples).toEqual([{ t: 0, p: 0 }]);
  });

  it("captures a sample when completion percent rises", () => {
    let percent = 0;
    let now = 0;
    const { result, rerender } = renderHook(() =>
      useChallengeRecorder({
        completionPercent: percent,
        getTimerSeconds: () => now,
        storageKey: "game-1",
      }),
    );

    percent = 20;
    now = 15;
    rerender();
    percent = 55;
    now = 48;
    rerender();

    expect(result.current.samples).toEqual([
      { t: 0, p: 0 },
      { t: 15, p: 20 },
      { t: 48, p: 55 },
    ]);
  });

  it("does not capture a sample when percent stalls or dips", () => {
    let percent = 30;
    const { result, rerender } = renderHook(() =>
      useChallengeRecorder({
        completionPercent: percent,
        getTimerSeconds: () => 10,
        storageKey: "game-1",
      }),
    );
    const afterFirst = result.current.samples;

    percent = 30; // unchanged
    rerender();
    percent = 12; // dipped (an erase)
    rerender();

    expect(result.current.samples).toEqual(afterFirst);
  });

  it("persists the timeline and rehydrates a remounted recorder", () => {
    let percent = 0;
    const first = renderHook(() =>
      useChallengeRecorder({
        completionPercent: percent,
        getTimerSeconds: () => 7,
        storageKey: "game-1",
      }),
    );
    percent = 40;
    first.rerender();
    first.unmount();

    const second = renderHook(() =>
      useChallengeRecorder({
        completionPercent: 0,
        getTimerSeconds: () => 0,
        storageKey: "game-1",
      }),
    );
    expect(second.result.current.samples).toEqual([
      { t: 0, p: 0 },
      { t: 7, p: 40 },
    ]);
  });

  it("reset clears the timeline back to the seed", () => {
    let percent = 0;
    const { result, rerender } = renderHook(() =>
      useChallengeRecorder({
        completionPercent: percent,
        getTimerSeconds: () => 5,
        storageKey: "game-1",
      }),
    );
    percent = 60;
    rerender();
    expect(result.current.samples.length).toBe(2);

    // reset accompanies a board reset, so percent is already back to 0.
    percent = 0;
    act(() => result.current.reset());
    expect(result.current.samples).toEqual([{ t: 0, p: 0 }]);
  });
});
