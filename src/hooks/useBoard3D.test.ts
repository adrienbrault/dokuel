import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useBoard3D } from "./useBoard3D.ts";

afterEach(() => {
  localStorage.clear();
});

describe("useBoard3D", () => {
  it("keeps every mounted copy in step with a toggle", () => {
    const settings = renderHook(() => useBoard3D());
    const board = renderHook(() => useBoard3D());
    expect(board.result.current.enabled).toBe(true);
    act(() => settings.result.current.setEnabled(false));
    expect(board.result.current.enabled).toBe(false);
  });

  it("never activates where WebGL is missing", () => {
    const { result } = renderHook(() => useBoard3D());
    expect(result.current.active).toBe(false);
  });
});
