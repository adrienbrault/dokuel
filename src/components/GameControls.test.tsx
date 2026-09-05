import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GameControls } from "./GameControls.tsx";

describe("GameControls", () => {
  it("replays a move through the redo button", async () => {
    const onRedo = vi.fn();
    render(
      <GameControls
        onErase={vi.fn()}
        onUndo={vi.fn()}
        onRedo={onRedo}
        redoLength={1}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(onRedo).toHaveBeenCalled();
  });

  it("fills the notes through the notes button", async () => {
    const onFillNotes = vi.fn();
    render(
      <GameControls
        onErase={vi.fn()}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        onFillNotes={onFillNotes}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Fill notes" }));
    expect(onFillNotes).toHaveBeenCalled();
  });

  it("hides the notes button when filling is not offered", () => {
    // Paper assist means no help at all, so the caller withholds the
    // callback and the control disappears rather than sitting dead.
    render(
      <GameControls onErase={vi.fn()} onUndo={vi.fn()} onRedo={vi.fn()} />,
    );

    expect(
      screen.queryByRole("button", { name: "Fill notes" }),
    ).not.toBeInTheDocument();
  });

  it("disables redo while there is nothing to replay", () => {
    render(
      <GameControls
        onErase={vi.fn()}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        redoLength={0}
      />,
    );

    expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled();
  });
});
