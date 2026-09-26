import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useOnlineStatus } from "./useOnlineStatus.ts";

function goOffline(offline: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(!offline);
  window.dispatchEvent(new Event(offline ? "offline" : "online"));
}

describe("useOnlineStatus", () => {
  it("follows the browser as the connection drops and returns", () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    act(() => goOffline(true));
    expect(result.current).toBe(false);

    act(() => goOffline(false));
    expect(result.current).toBe(true);
  });
});
