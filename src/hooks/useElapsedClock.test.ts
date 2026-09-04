import { renderHook } from "@testing-library/react";
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
});
