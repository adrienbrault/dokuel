import { describe, expect, it, vi } from "vitest";
import { registerServiceWorker } from "./register-sw.ts";

describe("registerServiceWorker", () => {
  it("does nothing when the browser has no service worker support", () => {
    const register = vi.fn();

    expect(registerServiceWorker(register)).toBe(false);
    expect(register).not.toHaveBeenCalled();
  });

  it("registers immediately when the browser supports service workers", () => {
    const register = vi.fn();
    Object.defineProperty(navigator, "serviceWorker", {
      value: {},
      configurable: true,
    });

    try {
      expect(registerServiceWorker(register)).toBe(true);
      expect(register).toHaveBeenCalledWith({ immediate: true });
    } finally {
      Reflect.deleteProperty(navigator, "serviceWorker");
    }
  });
});
