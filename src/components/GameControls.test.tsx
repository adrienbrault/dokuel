import { describe, expect, it, jest } from "bun:test";
import { render, screen } from "@testing-library/react";
import { GameControls } from "./GameControls.tsx";

describe("GameControls", () => {
  it("renders all four control labels", () => {
    render(
      <GameControls
        notesMode={false}
        onToggleNotes={jest.fn()}
        onErase={jest.fn()}
        onUndo={jest.fn()}
        historyLength={1}
        onHint={jest.fn()}
      />,
    );

    expect(screen.getByLabelText("Undo")).toBeInTheDocument();
    expect(screen.getByLabelText("Erase")).toBeInTheDocument();
    expect(screen.getByLabelText("Notes")).toBeInTheDocument();
    expect(screen.getByLabelText("Hint")).toBeInTheDocument();
  });

  it("renders three controls when onHint is not provided", () => {
    render(
      <GameControls
        notesMode={false}
        onToggleNotes={jest.fn()}
        onErase={jest.fn()}
        onUndo={jest.fn()}
      />,
    );

    expect(screen.getByLabelText("Undo")).toBeInTheDocument();
    expect(screen.getByLabelText("Erase")).toBeInTheDocument();
    expect(screen.getByLabelText("Notes")).toBeInTheDocument();
    expect(screen.queryByLabelText("Hint")).not.toBeInTheDocument();
  });

  it("marks Notes button as pressed when notesMode is active", () => {
    render(
      <GameControls
        notesMode={true}
        onToggleNotes={jest.fn()}
        onErase={jest.fn()}
        onUndo={jest.fn()}
      />,
    );

    expect(screen.getByLabelText("Notes")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("disables Undo when history is empty", () => {
    render(
      <GameControls
        notesMode={false}
        onToggleNotes={jest.fn()}
        onErase={jest.fn()}
        onUndo={jest.fn()}
        historyLength={0}
      />,
    );

    expect(screen.getByLabelText("Undo")).toBeDisabled();
  });
});
