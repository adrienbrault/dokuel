import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useGuideProgress } from "./useGuideProgress.ts";

describe("useGuideProgress", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("starts with no viewed guides", () => {
    const { result } = renderHook(() => useGuideProgress());
    expect(result.current.viewed.size).toBe(0);
    expect(result.current.isNew("scanning")).toBe(true);
    expect(result.current.isViewed("scanning")).toBe(false);
  });

  it("markViewed flips isViewed/isNew and persists across reloads", () => {
    const { result } = renderHook(() => useGuideProgress());
    act(() => result.current.markViewed("naked-singles"));

    expect(result.current.isViewed("naked-singles")).toBe(true);
    expect(result.current.isNew("naked-singles")).toBe(false);

    // A fresh hook instance reads from the same localStorage entry.
    const second = renderHook(() => useGuideProgress());
    expect(second.result.current.isViewed("naked-singles")).toBe(true);
  });

  it("markViewed is idempotent", () => {
    const { result } = renderHook(() => useGuideProgress());
    act(() => result.current.markViewed("hidden-singles"));
    act(() => result.current.markViewed("hidden-singles"));
    expect(result.current.viewed.size).toBe(1);
  });
});
