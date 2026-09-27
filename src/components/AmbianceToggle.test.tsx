import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import {
  getAmbianceEnabled,
  setAmbianceEnabled,
} from "../lib/ambiance-settings.ts";
import { AmbianceToggle } from "./AmbianceToggle.tsx";

describe("AmbianceToggle", () => {
  beforeEach(() => setAmbianceEnabled(true));

  it("turns the 3D world off and back on", async () => {
    render(<AmbianceToggle />);
    const toggle = screen.getByRole("button", { name: "3D world" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(toggle);
    expect(getAmbianceEnabled()).toBe(false);
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(toggle);
    expect(getAmbianceEnabled()).toBe(true);
  });
});
