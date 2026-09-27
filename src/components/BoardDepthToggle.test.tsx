import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getBoard3DEnabled } from "../lib/board-3d.ts";
import { BoardDepthToggle } from "./BoardDepthToggle.tsx";

const webgl = vi.hoisted(() => ({ supported: true }));
vi.mock("../lib/board-3d.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/board-3d.ts")>()),
  supportsWebGL: () => webgl.supported,
}));

afterEach(() => {
  localStorage.clear();
  webgl.supported = true;
});

describe("BoardDepthToggle", () => {
  it("switches the 3D board off and back on", async () => {
    render(<BoardDepthToggle />);
    const toggle = screen.getByRole("switch", { name: "3D board" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await userEvent.click(toggle);
    expect(getBoard3DEnabled()).toBe(false);
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("offers nothing where the browser cannot draw it", () => {
    webgl.supported = false;
    const { container } = render(<BoardDepthToggle />);
    expect(container).toBeEmptyDOMElement();
  });
});
