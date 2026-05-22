import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadGame } from "../lib/game-storage.ts";
import { getMultiplayerStats } from "../lib/multiplayer-stats.ts";
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
    opponentName: "Brave Otter",
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

      // Place a value to trigger autosave (it watches game.board, not the
      // timer ref). Digit-first: tap the digit, then tap the cell.
      fireEvent.click(screen.getAllByLabelText("5")[0]!);
      fireEvent.click(screen.getByLabelText(/Cell row 1 column 1, empty/));

      const saved = loadGame(`mp_${props.roomId}_${props.puzzle.slice(0, 12)}`);
      expect(saved?.timer).toBeGreaterThanOrEqual(7);

      unmount();
      render(<MultiplayerBoard {...props} />);

      expect(screen.getByText(/^00:0[7-9]$/)).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("fills a tapped cell with the highlighted digit (digit-first)", () => {
    vi.useFakeTimers();
    try {
      render(<MultiplayerBoard {...baseProps()} />);

      // Tap a numpad digit first — with no cell selected it becomes the
      // active digit.
      const five = screen.getAllByLabelText("5")[0]!;
      fireEvent.pointerDown(five, { pointerType: "touch" });
      fireEvent.pointerUp(five, { pointerType: "touch" });

      // Tapping an empty cell fills it with the active digit; the cell is
      // not selected, so the digit stays active for the next tap.
      fireEvent.click(screen.getByLabelText(/Cell row 1 column 1, empty/));
      const filledCell = screen.getByLabelText(/Cell row 1 column 1, value 5/);
      expect(filledCell.className).not.toContain("cell-selected-glow");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the cell selected after a numpad hold places a note", () => {
    vi.useFakeTimers();
    try {
      render(<MultiplayerBoard {...baseProps()} />);

      const cell = screen.getByLabelText(/Cell row 1 column 1, empty/);
      fireEvent.click(cell);

      // Holding past the threshold adds a pencil note.
      const five = screen.getAllByLabelText("5")[0]!;
      fireEvent.pointerDown(five, { pointerType: "touch" });
      act(() => {
        vi.advanceTimersByTime(500);
      });
      fireEvent.pointerUp(five, { pointerType: "touch" });

      // The note lands (the cell keeps no value) and stays selected so the
      // player can keep penciling into it without re-tapping the cell.
      const noted = screen.getByLabelText(/Cell row 1 column 1, empty/);
      expect(noted.textContent).toContain("5");
      expect(noted.className).toContain("cell-selected-glow");
    } finally {
      vi.useRealTimers();
    }
  });

  it("toggles digit highlight when numpad is tapped with no cell selected", () => {
    vi.useFakeTimers();
    try {
      render(<MultiplayerBoard {...baseProps()} />);

      // No cell selected. Tap "7" on the numpad → cells with value 7
      // should pick up the same-number background.
      const seven = screen.getAllByLabelText("7")[0]!;
      fireEvent.pointerDown(seven, { pointerType: "touch" });
      fireEvent.pointerUp(seven, { pointerType: "touch" });

      // (0,4) holds 7 in PUZZLE.
      const cell04 = screen.getByLabelText("Cell row 1 column 5, value 7");
      expect(cell04.className).toContain("bg-cell-same-number");

      // Tap "7" again → toggles the highlight off.
      fireEvent.pointerDown(seven, { pointerType: "touch" });
      fireEvent.pointerUp(seven, { pointerType: "touch" });
      const cell04After = screen.getByLabelText("Cell row 1 column 5, value 7");
      expect(cell04After.className).not.toContain("bg-cell-same-number");
    } finally {
      vi.useRealTimers();
    }
  });

  it("switches highlight when a different digit is tapped", () => {
    vi.useFakeTimers();
    try {
      render(<MultiplayerBoard {...baseProps()} />);

      const seven = screen.getAllByLabelText("7")[0]!;
      fireEvent.pointerDown(seven, { pointerType: "touch" });
      fireEvent.pointerUp(seven, { pointerType: "touch" });

      const eight = screen.getAllByLabelText("8")[0]!;
      fireEvent.pointerDown(eight, { pointerType: "touch" });
      fireEvent.pointerUp(eight, { pointerType: "touch" });

      // 7 should no longer highlight; 8 should.
      expect(
        screen.getByLabelText("Cell row 1 column 5, value 7").className,
      ).not.toContain("bg-cell-same-number");
      // (0,5)=8 in PUZZLE
      expect(
        screen.getByLabelText("Cell row 1 column 6, value 8").className,
      ).toContain("bg-cell-same-number");
    } finally {
      vi.useRealTimers();
    }
  });

  it("drops the cell selection when a numpad digit is tapped", () => {
    vi.useFakeTimers();
    try {
      render(<MultiplayerBoard {...baseProps()} />);

      // Select an empty cell.
      const cell = screen.getByLabelText(/Cell row 1 column 1, empty/);
      fireEvent.click(cell);
      expect(cell.className).toContain("cell-selected-glow");

      // Tapping a numpad digit drops the selection and highlights the
      // digit instead of placing a value into the cell.
      const seven = screen.getAllByLabelText("7")[0]!;
      fireEvent.pointerDown(seven, { pointerType: "touch" });
      fireEvent.pointerUp(seven, { pointerType: "touch" });

      const after = screen.getByLabelText(/Cell row 1 column 1, empty/);
      expect(after.className).not.toContain("cell-selected-glow");
      expect(
        screen.getByLabelText("Cell row 1 column 5, value 7").className,
      ).toContain("bg-cell-same-number");
    } finally {
      vi.useRealTimers();
    }
  });

  it("enables the undo button after a move and reverts the change on click", () => {
    vi.useFakeTimers();
    try {
      render(<MultiplayerBoard {...baseProps()} />);

      // Undo starts disabled — nothing in history yet.
      const undo = screen.getByLabelText("Undo") as HTMLButtonElement;
      expect(undo.disabled).toBe(true);

      // Place a 5 in (0,0): tap the digit, then tap the cell.
      const five = screen.getAllByLabelText("5")[0]!;
      fireEvent.pointerDown(five, { pointerType: "touch" });
      fireEvent.pointerUp(five, { pointerType: "touch" });
      fireEvent.click(screen.getByLabelText(/Cell row 1 column 1, empty/));
      expect(
        screen.queryByLabelText(/Cell row 1 column 1, value 5/),
      ).not.toBeNull();

      // After the move, undo must be clickable.
      expect(
        (screen.getByLabelText("Undo") as HTMLButtonElement).disabled,
      ).toBe(false);

      fireEvent.click(screen.getByLabelText("Undo"));
      expect(
        screen.queryByLabelText(/Cell row 1 column 1, empty/),
      ).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("restores placed cell values on remount with same roomId and puzzle", () => {
    vi.useFakeTimers();
    try {
      const props = baseProps();
      const { unmount } = render(<MultiplayerBoard {...props} />);

      // (0,0) is empty in PUZZLE; correct solution value is 5.
      // Digit-first: tap the digit, then tap the cell to fill it.
      const five = screen.getAllByLabelText("5")[0]!;
      fireEvent.pointerDown(five, { pointerType: "touch" });
      fireEvent.pointerUp(five, { pointerType: "touch" });
      fireEvent.click(screen.getByLabelText(/Cell row 1 column 1, empty/));

      expect(
        screen.queryByLabelText(/Cell row 1 column 1, value 5/),
      ).not.toBeNull();

      unmount();
      render(<MultiplayerBoard {...props} />);

      expect(
        screen.queryByLabelText(/Cell row 1 column 1, value 5/),
      ).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("MultiplayerBoard after opponent wins", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("lets the loser keep placing digits after the opponent wins", () => {
    vi.useFakeTimers();
    try {
      const props = {
        ...baseProps(),
        gameOver: { winnerId: "p2", winnerName: "Opponent" },
      };
      render(<MultiplayerBoard {...props} />);

      // (0,0) is empty in PUZZLE; correct solution value is 5.
      // Digit-first: tap the digit, then tap the cell to fill it.
      const five = screen.getAllByLabelText("5")[0]!;
      fireEvent.pointerDown(five, { pointerType: "touch" });
      fireEvent.pointerUp(five, { pointerType: "touch" });
      fireEvent.click(screen.getByLabelText(/Cell row 1 column 1, empty/));

      // Loser can still commit values to their board.
      expect(
        screen.queryByLabelText(/Cell row 1 column 1, value 5/),
      ).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not show the result modal to the loser while they keep playing", () => {
    vi.useFakeTimers();
    try {
      const props = {
        ...baseProps(),
        gameOver: { winnerId: "p2", winnerName: "Opponent" },
      };
      render(<MultiplayerBoard {...props} />);

      // Even after the delayed-flag window elapses, the loser sees no
      // "Puzzle Complete!" modal — they are still mid-puzzle.
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.queryByText(/Puzzle Complete!/)).toBeNull();
      expect(screen.queryByText(/You Won!/)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the loser's timer running after the opponent wins", () => {
    vi.useFakeTimers();
    try {
      const props = {
        ...baseProps(),
        gameOver: { winnerId: "p2", winnerName: "Opponent" },
      };
      render(<MultiplayerBoard {...props} />);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Timer kept ticking past 0:00 — loser is still in their game.
      expect(screen.getByText(/^00:0[4-9]$/)).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows a banner with the winner's name while the loser keeps playing", () => {
    const props = {
      ...baseProps(),
      gameOver: { winnerId: "p2", winnerName: "Alice" },
    };
    render(<MultiplayerBoard {...props} />);

    expect(screen.queryByText(/Alice/)).not.toBeNull();
    expect(screen.queryByText(/finished first/)).not.toBeNull();
  });

  it("records a loss with opponent name when the opponent wins", () => {
    const props = {
      ...baseProps(),
      gameOver: { winnerId: "p2", winnerName: "Brave Otter" },
    };
    render(<MultiplayerBoard {...props} />);

    const all = getMultiplayerStats();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({
      difficulty: "easy",
      won: false,
      opponentName: "Brave Otter",
      roomId: "room-abc",
      gameNumber: 1,
    });
  });

  it("records a win when this player is the winner", () => {
    const props = {
      ...baseProps(),
      gameOver: { winnerId: "p1", winnerName: "Me" },
    };
    render(<MultiplayerBoard {...props} />);

    const all = getMultiplayerStats();
    expect(all).toHaveLength(1);
    expect(all[0]?.won).toBe(true);
  });

  it("does not record a duplicate record on remount for the same gameNumber", () => {
    const props = {
      ...baseProps(),
      gameOver: { winnerId: "p2", winnerName: "Brave Otter" },
    };
    const { unmount } = render(<MultiplayerBoard {...props} />);
    unmount();
    render(<MultiplayerBoard {...props} />);

    expect(getMultiplayerStats()).toHaveLength(1);
  });

  it("preserves the loser's autosave so they can resume after a refresh", () => {
    vi.useFakeTimers();
    try {
      const props = {
        ...baseProps(),
        gameOver: { winnerId: "p2", winnerName: "Opponent" },
      };
      const { unmount } = render(<MultiplayerBoard {...props} />);

      // Digit-first: tap the digit, then tap the cell to fill it.
      const five = screen.getAllByLabelText("5")[0]!;
      fireEvent.pointerDown(five, { pointerType: "touch" });
      fireEvent.pointerUp(five, { pointerType: "touch" });
      fireEvent.click(screen.getByLabelText(/Cell row 1 column 1, empty/));

      // Save should exist while the loser is still working on their board.
      const key = `mp_${props.roomId}_${props.puzzle.slice(0, 12)}`;
      expect(loadGame(key)).not.toBeNull();

      unmount();
      render(<MultiplayerBoard {...props} />);

      // Their digit comes back after a remount.
      expect(
        screen.queryByLabelText(/Cell row 1 column 1, value 5/),
      ).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("MultiplayerBoard digit drag", () => {
  beforeEach(() => {
    localStorage.clear();
    document.elementFromPoint = (() =>
      null) as typeof document.elementFromPoint;
  });

  afterEach(() => {
    localStorage.clear();
    document.elementFromPoint = (() =>
      null) as typeof document.elementFromPoint;
  });

  it("stops a numpad drag and resumes the skim when it returns to the numpad", () => {
    render(<MultiplayerBoard {...baseProps()} />);

    const three = screen.getByRole("button", { name: "3" });
    const five = screen.getByRole("button", { name: "5" });
    const boardCell = screen.getByLabelText("Cell row 1 column 1, empty");

    // Press digit 3 and pan straight off the numpad → drag-to-place.
    fireEvent.pointerDown(three, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.pointerMove(three, {
      pointerType: "touch",
      pointerId: 1,
      clientX: 0,
      clientY: 50,
    });
    expect(screen.queryByTestId("digit-drag-indicator")).not.toBeNull();

    // Drag over a board cell — the drag has now left the numpad.
    document.elementFromPoint = (() =>
      boardCell) as typeof document.elementFromPoint;
    act(() => {
      document.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          pointerId: 1,
          clientX: 40,
          clientY: 20,
        }),
      );
    });

    // Bring the finger back over numpad digit 5 → the drag stops and the
    // skim resumes on the digit now under the finger.
    document.elementFromPoint = (() =>
      five) as typeof document.elementFromPoint;
    act(() => {
      document.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          pointerId: 1,
          clientX: 0,
          clientY: 0,
        }),
      );
    });

    expect(screen.queryByTestId("digit-drag-indicator")).toBeNull();
    expect(five.className).toContain("bg-accent");
    expect(three.className).not.toContain("bg-accent");
  });
});
