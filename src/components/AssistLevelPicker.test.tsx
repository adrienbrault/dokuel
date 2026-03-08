// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AssistLevelPicker } from "./AssistLevelPicker.tsx";

describe("AssistLevelPicker", () => {
  it("renders three options", () => {
    render(<AssistLevelPicker value="standard" onChange={vi.fn()} />);

    expect(screen.getByRole("radio", { name: /paper/i })).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /standard/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /full/i })).toBeInTheDocument();
  });

  it("marks the active option as checked", () => {
    render(<AssistLevelPicker value="paper" onChange={vi.fn()} />);

    expect(screen.getByRole("radio", { name: /paper/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /standard/i })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: /full/i })).not.toBeChecked();
  });

  it("calls onChange when a different option is clicked", async () => {
    const onChange = vi.fn();
    render(<AssistLevelPicker value="standard" onChange={onChange} />);

    await userEvent.click(screen.getByRole("radio", { name: /full/i }));
    expect(onChange).toHaveBeenCalledWith("full");
  });

  it("does not call onChange when the active option is clicked", async () => {
    const onChange = vi.fn();
    render(<AssistLevelPicker value="standard" onChange={onChange} />);

    await userEvent.click(screen.getByRole("radio", { name: /standard/i }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("uses radiogroup role on container", () => {
    render(<AssistLevelPicker value="standard" onChange={vi.fn()} />);
    expect(
      screen.getByRole("radiogroup", { name: /assistance/i }),
    ).toBeInTheDocument();
  });
});
