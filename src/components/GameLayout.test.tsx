import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GameLayout } from "./GameLayout.tsx";

function renderLayout(
  overrides: Partial<Parameters<typeof GameLayout>[0]> = {},
) {
  return render(
    <GameLayout
      onBack={vi.fn()}
      timer={<span>00:00</span>}
      numPad={<div>pad</div>}
      board={<div>board</div>}
      controls={<div>controls</div>}
      position="bottom"
      onPositionChange={vi.fn()}
      {...overrides}
    />,
  );
}

describe("GameLayout settings", () => {
  it("documents the number pad gestures", async () => {
    const user = userEvent.setup();
    renderLayout();

    // Closed by default — the gestures live behind the gear, not on the pad.
    expect(screen.queryByText("Number pad gestures")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Settings" }));

    expect(screen.getByText("Number pad gestures")).toBeInTheDocument();
    for (const verb of ["Tap", "Hold", "Drag", "Slide"]) {
      expect(screen.getByText(verb)).toBeInTheDocument();
    }
  });

  it("closes the popover when the close button is used", async () => {
    const user = userEvent.setup();
    renderLayout();

    const settings = screen.getByRole("button", { name: "Settings" });
    await user.click(settings);
    expect(settings).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: "Close settings" }));
    expect(settings).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Number pad gestures")).not.toBeInTheDocument();
  });
});

describe("GameLayout play area", () => {
  it("tracks the number pad position so the grid can place the pad", () => {
    const { rerender } = renderLayout();
    const grid = () => document.querySelector(".game-grid");

    expect(grid()).toHaveAttribute("data-pad", "bottom");

    rerender(
      <GameLayout
        onBack={vi.fn()}
        timer={<span>00:00</span>}
        numPad={<div>pad</div>}
        board={<div>board</div>}
        controls={<div>controls</div>}
        position="left"
        onPositionChange={vi.fn()}
      />,
    );
    expect(grid()).toHaveAttribute("data-pad", "left");
  });

  it("renders the board, pad and controls exactly once each", () => {
    renderLayout();
    expect(screen.getAllByText("board")).toHaveLength(1);
    expect(screen.getAllByText("pad")).toHaveLength(1);
    expect(screen.getAllByText("controls")).toHaveLength(1);
  });
});
