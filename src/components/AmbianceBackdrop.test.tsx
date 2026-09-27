import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ambiance } from "../lib/ambiance.ts";
import { setAmbianceEnabled } from "../lib/ambiance-settings.ts";
import { AmbianceBackdrop } from "./AmbianceBackdrop.tsx";

// The GPU is the system boundary: jsdom has no WebGL, so the engine is
// replaced by a recorder and the tests cover how the backdrop drives it.
const { engine, createAmbianceEngine } = vi.hoisted(() => {
  const engine = { handle: vi.fn(), setDark: vi.fn(), dispose: vi.fn() };
  return { engine, createAmbianceEngine: vi.fn(async () => engine) };
});
vi.mock("../scene/engine.ts", () => ({ createAmbianceEngine }));

function withWebGL2() {
  vi.stubGlobal("WebGL2RenderingContext", class {});
}

describe("AmbianceBackdrop", () => {
  beforeEach(() => {
    localStorage.clear();
    setAmbianceEnabled(true);
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete document.documentElement.dataset.ambiance;
    document.documentElement.classList.remove("dark");
  });

  it("stays out of the way without WebGL2", () => {
    const { container } = render(<AmbianceBackdrop />);

    expect(container.querySelector("canvas")).toBeNull();
    expect(createAmbianceEngine).not.toHaveBeenCalled();
    expect(document.documentElement.dataset.ambiance).toBeUndefined();
  });

  it("starts the scene, marks the page, and forwards game events", async () => {
    withWebGL2();
    const { container } = render(<AmbianceBackdrop />);

    expect(container.querySelector("canvas")).not.toBeNull();
    await waitFor(() =>
      expect(document.documentElement.dataset.ambiance).toBe("on"),
    );
    ambiance.emit({ type: "victory" });

    expect(engine.handle).toHaveBeenCalledWith({ type: "victory" });
  });

  it("follows the theme class on <html>", async () => {
    withWebGL2();
    render(<AmbianceBackdrop />);
    await waitFor(() =>
      expect(document.documentElement.dataset.ambiance).toBe("on"),
    );

    document.documentElement.classList.add("dark");

    await waitFor(() => expect(engine.setDark).toHaveBeenLastCalledWith(true));
  });

  it("tears the scene down when the player turns it off", async () => {
    withWebGL2();
    const { container } = render(<AmbianceBackdrop />);
    await waitFor(() =>
      expect(document.documentElement.dataset.ambiance).toBe("on"),
    );

    act(() => setAmbianceEnabled(false));

    expect(engine.dispose).toHaveBeenCalled();
    expect(container.querySelector("canvas")).toBeNull();
    expect(document.documentElement.dataset.ambiance).toBeUndefined();
    ambiance.emit({ type: "victory" });
    expect(engine.handle).not.toHaveBeenCalled();
  });

  it("falls back to the CSS backdrop when the scene fails to start", async () => {
    withWebGL2();
    createAmbianceEngine.mockRejectedValueOnce(new Error("no context"));
    const { container } = render(<AmbianceBackdrop />);

    await waitFor(() => expect(container.querySelector("canvas")).toBeNull());
    expect(document.documentElement.dataset.ambiance).toBeUndefined();
  });
});
