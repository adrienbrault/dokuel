import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DigitColorPicker } from "./DigitColorPicker.tsx";

describe("DigitColorPicker", () => {
  it("offers the plain board, tinted digits and colors alone", () => {
    render(<DigitColorPicker mode="off" onChange={vi.fn()} />);

    const chosen = screen.getByRole("radio", { checked: true });
    expect(chosen).toHaveAccessibleName("Off");
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("reports the mode the player picks", async () => {
    const onChange = vi.fn();
    render(<DigitColorPicker mode="off" onChange={onChange} />);

    await userEvent.click(screen.getByRole("radio", { name: "Colors" }));

    expect(onChange).toHaveBeenCalledWith("colors");
  });
});
