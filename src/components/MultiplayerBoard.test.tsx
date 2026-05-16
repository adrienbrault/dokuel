import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MultiplayerBoard } from "./MultiplayerBoard.tsx";

const SOLVED =
  "534678912" +
  "672195348" +
  "198342567" +
  "859761423" +
  "426853791" +
  "713924856" +
  "961537284" +
  "287419635" +
  "345286179";

// Three empty cells so placing one does not complete the puzzle and trigger
// the autosave cleanup path.
const PUZZLE = `...${SOLVED.slice(3)}`;

function baseProps() {
  return {
    roomId: "room-abc",
    puzzle: PUZZLE,
    playerId: "p1",
    difficulty: "easy" as const,
    opponentProgress: null,
    opponentDisconnected: false,
    gameOver: null,
    onProgress: vi.fn(),
    onComplete: vi.fn(),
    onRematch: vi.fn(),
    onBack: vi.fn(),
  };
}

describe("MultiplayerBoard local autosave", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("restores placed cell values on remount with same roomId and puzzle", () => {
    const props = baseProps();

    const { unmount } = render(<MultiplayerBoard {...props} />);

    // (0,0) is empty in PUZZLE; correct solution value is 5.
    const cell = screen.getByLabelText(/Cell row 1 column 1, empty/);
    fireEvent.click(cell);
    // GameLayout renders the NumPad twice (responsive: side/bottom). Either
    // button dispatches the same action — pick the first.
    fireEvent.click(screen.getAllByLabelText("5")[0]!);

    expect(
      screen.queryByLabelText(/Cell row 1 column 1, value 5/),
    ).not.toBeNull();

    unmount();
    render(<MultiplayerBoard {...props} />);

    expect(
      screen.queryByLabelText(/Cell row 1 column 1, value 5/),
    ).not.toBeNull();
  });
});
