import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { GameLayout } from "./GameLayout.tsx";

function renderLayout(props: Partial<Parameters<typeof GameLayout>[0]> = {}) {
  return render(
    <GameLayout
      onBack={() => {}}
      timer={null}
      numPad={null}
      board={null}
      controls={null}
      position="bottom"
      onPositionChange={() => {}}
      {...props}
    />,
  );
}

describe("GameLayout", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.digitColor;
  });

  it("draws the board from the room's style when the host pinned one", async () => {
    // The guest never picked emoji, but the room did: a shared board
    // is only shared if both players read the same symbols.
    localStorage.setItem("sudoku_digit_color_mode", "off");

    renderLayout({ digitStyle: { mode: "emoji", emojiTheme: "vehicles" } });

    expect(document.documentElement.dataset.digitColor).toBe("emoji");
    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByText("Set by the host")).toBeInTheDocument();
    expect(
      screen.queryByRole("radiogroup", { name: "Digit colors" }),
    ).not.toBeInTheDocument();
  });
});
