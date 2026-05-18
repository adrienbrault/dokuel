import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NumPadLayoutToggle } from "./NumPadLayoutToggle.tsx";

describe("NumPadLayoutToggle", () => {
  it("renders two layout options", () => {
    render(<NumPadLayoutToggle layout="linear" onChange={vi.fn()} />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
  });

  it("marks the current layout as checked", () => {
    render(<NumPadLayoutToggle layout="grid" onChange={vi.fn()} />);
    expect(screen.getByLabelText("Layout grid")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByLabelText("Layout linear")).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("calls onChange with grid when grid button is clicked", async () => {
    const onChange = vi.fn();
    render(<NumPadLayoutToggle layout="linear" onChange={onChange} />);
    await userEvent.click(screen.getByLabelText("Layout grid"));
    expect(onChange).toHaveBeenCalledWith("grid");
  });

  it("calls onChange with linear when linear button is clicked", async () => {
    const onChange = vi.fn();
    render(<NumPadLayoutToggle layout="grid" onChange={onChange} />);
    await userEvent.click(screen.getByLabelText("Layout linear"));
    expect(onChange).toHaveBeenCalledWith("linear");
  });

  it("has radiogroup role with accessible label", () => {
    render(<NumPadLayoutToggle layout="linear" onChange={vi.fn()} />);
    expect(
      screen.getByRole("radiogroup", { name: "Number pad layout" }),
    ).toBeInTheDocument();
  });
});
