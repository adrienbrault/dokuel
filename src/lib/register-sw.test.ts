import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type RegisterSW, registerServiceWorker } from "./register-sw.ts";

describe("registerServiceWorker", () => {
  it("does nothing when the browser has no service worker support", () => {
    const register = vi.fn();

    expect(registerServiceWorker(register, () => true)).toBe(false);
    expect(register).not.toHaveBeenCalled();
  });

  describe("with service worker support", () => {
    beforeEach(() => {
      Object.defineProperty(navigator, "serviceWorker", {
        value: {},
        configurable: true,
      });
    });

    afterEach(() => {
      Reflect.deleteProperty(navigator, "serviceWorker");
    });

    it("registers immediately", () => {
      const register = vi.fn<RegisterSW>(() => vi.fn());

      expect(registerServiceWorker(register, () => true)).toBe(true);
      expect(register).toHaveBeenCalledWith(
        expect.objectContaining({ immediate: true }),
      );
    });

    it("applies a waiting update when nothing is at stake", () => {
      // A new deploy is picked up on a menu screen, where a reload
      // costs the player nothing.
      const update = vi.fn();
      const register = vi.fn<RegisterSW>(() => update);
      registerServiceWorker(register, () => true);

      register.mock.calls[0]?.[0].onNeedRefresh?.();

      expect(update).toHaveBeenCalledWith(true);
    });

    it("leaves a waiting update alone mid-game", () => {
      // Mid-move, mid-race, the page must not reload under the player.
      // The worker keeps waiting and takes over on the next launch.
      const update = vi.fn();
      const register = vi.fn<RegisterSW>(() => update);
      registerServiceWorker(register, () => false);

      register.mock.calls[0]?.[0].onNeedRefresh?.();

      expect(update).not.toHaveBeenCalled();
    });
  });
});
