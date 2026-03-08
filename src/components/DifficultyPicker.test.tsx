import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DifficultyPicker } from "./DifficultyPicker.tsx";

describe("DifficultyPicker", () => {
  it("renders difficulty options", () => {
    render(<DifficultyPicker onSelect={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByText("Easy")).toBeInTheDocument();
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("Hard")).toBeInTheDocument();
    expect(screen.getByText("Expert")).toBeInTheDocument();
  });

  it("calls onSelect with difficulty and showConflicts true by default", async () => {
    const onSelect = vi.fn();
    render(<DifficultyPicker onSelect={onSelect} onBack={vi.fn()} />);

    await userEvent.click(screen.getByText("Medium"));
    expect(onSelect).toHaveBeenCalledWith("medium", true);
  });

  it("shows placement feedback toggle defaulting to on", () => {
    render(<DifficultyPicker onSelect={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByText("Show placement errors")).toBeInTheDocument();
  });

  it("calls onSelect with showConflicts false when toggle is off", async () => {
    const onSelect = vi.fn();
    render(<DifficultyPicker onSelect={onSelect} onBack={vi.fn()} />);

    await userEvent.click(screen.getByLabelText("Show placement errors"));
    await userEvent.click(screen.getByText("Easy"));
    expect(onSelect).toHaveBeenCalledWith("easy", false);
  });
});
