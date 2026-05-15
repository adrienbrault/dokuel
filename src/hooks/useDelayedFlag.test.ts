import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDelayedFlag } from "./useDelayedFlag.ts";

describe("useDelayedFlag", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts false", () => {
    const { result } = renderHook(() => useDelayedFlag(true, 600));
    expect(result.current).toBe(false);
  });

  it("becomes true after the delay elapses while active", () => {
    const { result } = renderHook(() => useDelayedFlag(true, 600));
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current).toBe(true);
  });

  it("stays false when active is false", () => {
    const { result } = renderHook(() => useDelayedFlag(false, 600));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(false);
  });

  it("waits for active to flip before scheduling the timer", () => {
    const { result, rerender } = renderHook(
      ({ active }) => useDelayedFlag(active, 300),
      { initialProps: { active: false } },
    );

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe(false);

    rerender({ active: true });
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);
  });

  it("cancels the pending timer if active flips back to false", () => {
    const { result, rerender } = renderHook(
      ({ active }) => useDelayedFlag(active, 300),
      { initialProps: { active: true } },
    );

    act(() => {
      vi.advanceTimersByTime(150);
    });
    rerender({ active: false });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(false);
  });
});
