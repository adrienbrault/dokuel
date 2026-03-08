// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NumPadPositionToggle } from "./NumPadPositionToggle.tsx";

describe("NumPadPositionToggle", () => {
  it("renders three position options", () => {
    render(<NumPadPositionToggle position="bottom" onChange={vi.fn()} />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
  });

  it("marks the current position as checked", () => {
    render(<NumPadPositionToggle position="left" onChange={vi.fn()} />);
    expect(screen.getByLabelText("Pad left")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByLabelText("Pad bottom")).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByLabelText("Pad right")).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("calls onChange with left when left button is clicked", async () => {
    const onChange = vi.fn();
    render(<NumPadPositionToggle position="bottom" onChange={onChange} />);
    await userEvent.click(screen.getByLabelText("Pad left"));
    expect(onChange).toHaveBeenCalledWith("left");
  });

  it("calls onChange with right when right button is clicked", async () => {
    const onChange = vi.fn();
    render(<NumPadPositionToggle position="bottom" onChange={onChange} />);
    await userEvent.click(screen.getByLabelText("Pad right"));
    expect(onChange).toHaveBeenCalledWith("right");
  });

  it("calls onChange with bottom when bottom button is clicked", async () => {
    const onChange = vi.fn();
    render(<NumPadPositionToggle position="left" onChange={onChange} />);
    await userEvent.click(screen.getByLabelText("Pad bottom"));
    expect(onChange).toHaveBeenCalledWith("bottom");
  });

  it("has radiogroup role with accessible label", () => {
    render(<NumPadPositionToggle position="bottom" onChange={vi.fn()} />);
    expect(
      screen.getByRole("radiogroup", { name: "Number pad position" }),
    ).toBeInTheDocument();
  });

  it("updates checked state when position prop changes", () => {
    const { rerender } = render(
      <NumPadPositionToggle position="bottom" onChange={vi.fn()} />,
    );
    expect(screen.getByLabelText("Pad bottom")).toHaveAttribute(
      "aria-checked",
      "true",
    );

    rerender(<NumPadPositionToggle position="right" onChange={vi.fn()} />);
    expect(screen.getByLabelText("Pad right")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByLabelText("Pad bottom")).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });
});
