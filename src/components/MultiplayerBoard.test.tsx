import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadGame } from "../lib/game-storage.ts";
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
// Different shape so the rematch test can distinguish the boards: hole at
// (0,4) instead of (0,0..2).
const PUZZLE_B = `${SOLVED.slice(0, 4)}.${SOLVED.slice(5)}`;

function baseProps() {
  return {
    roomId: "room-abc",
    puzzle: PUZZLE,
    gameNumber: 1,
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

  it("swaps to the new puzzle when gameNumber increments without remounting", () => {
    const props = baseProps();
    const { rerender } = render(<MultiplayerBoard {...props} />);

    // Original puzzle: (0,0) empty, (0,4) is given as 7.
    expect(
      screen.queryByLabelText(/Cell row 1 column 1, empty/),
    ).not.toBeNull();
    expect(
      screen.queryByLabelText(/Cell row 1 column 5, value 7/),
    ).not.toBeNull();

    rerender(<MultiplayerBoard {...props} puzzle={PUZZLE_B} gameNumber={2} />);

    // New puzzle: (0,0) is given as 5, (0,4) is empty.
    expect(
      screen.queryByLabelText(/Cell row 1 column 1, value 5/),
    ).not.toBeNull();
    expect(
      screen.queryByLabelText(/Cell row 1 column 5, empty/),
    ).not.toBeNull();
  });

  it("restores the elapsed timer on remount", () => {
    vi.useFakeTimers();
    try {
      const props = baseProps();
      const { unmount } = render(<MultiplayerBoard {...props} />);

      // Advance fake time so the Timer's setInterval ticks and updates
      // timerSecondsRef via onTick.
      act(() => {
        vi.advanceTimersByTime(7000);
      });

      // Place a cell to trigger autosave (it watches game.board, not the
      // timer ref).
      const cell = screen.getByLabelText(/Cell row 1 column 1, empty/);
      fireEvent.click(cell);
      fireEvent.click(screen.getAllByLabelText("5")[0]!);

      const saved = loadGame(`mp_${props.roomId}_${props.puzzle.slice(0, 12)}`);
      expect(saved?.timer).toBeGreaterThanOrEqual(7);

      unmount();
      render(<MultiplayerBoard {...props} />);

      expect(screen.getByText(/^00:0[7-9]$/)).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
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
