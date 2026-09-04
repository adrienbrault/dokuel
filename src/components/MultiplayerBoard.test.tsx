import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadGame, multiplayerGameKey } from "../lib/game-storage.ts";
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
    solution: SOLVED,
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

  it("starts fresh when another game has the exact same puzzle", () => {
    const props = baseProps();
    const { unmount } = render(<MultiplayerBoard {...props} />);
    fireEvent.click(screen.getByLabelText(/Cell row 1 column 1, empty/));
    fireEvent.click(screen.getByRole("button", { name: "5" }));
    expect(screen.getByLabelText(/Cell row 1 column 1, value 5/)).toBeTruthy();
    unmount();
    render(<MultiplayerBoard {...props} gameNumber={2} />);
    expect(screen.getByLabelText(/Cell row 1 column 1, empty/)).toBeTruthy();
  });

  it("supports keyboard notes, values, undo and erase in a duel", () => {
    render(<MultiplayerBoard {...baseProps()} />);
    fireEvent.click(screen.getByLabelText(/Cell row 1 column 1, empty/));
    fireEvent.keyDown(window, { key: "n" });
    expect(screen.getByRole("button", { name: "Notes" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.keyDown(window, { key: "3" });
    expect(
      screen.getByLabelText(/Cell row 1 column 1, empty, notes 3/),
    ).toBeTruthy();
    fireEvent.keyDown(window, { key: "n" });
    fireEvent.keyDown(window, { key: "5" });
    expect(screen.getByLabelText(/Cell row 1 column 1, value 5/)).toBeTruthy();
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(
      screen.getByLabelText(/Cell row 1 column 1, empty, notes 3/),
    ).toBeTruthy();
    fireEvent.keyDown(window, { key: "Backspace" });
    expect(screen.getByLabelText("Cell row 1 column 1, empty")).toBeTruthy();
  });

  it("swaps to the merged puzzle when a start collision changes it without a gameNumber bump", () => {
    // Concurrent Start/Rematch: both writers used the same gameNumber,
    // LWW picked the other player's puzzle. The board must adopt it —
    // playing on into the divergent board can never complete.
    const props = baseProps();
    const { rerender } = render(<MultiplayerBoard {...props} />);

    expect(
      screen.queryByLabelText(/Cell row 1 column 1, empty/),
    ).not.toBeNull();

    rerender(<MultiplayerBoard {...props} puzzle={PUZZLE_B} gameNumber={1} />);

    expect(
      screen.queryByLabelText(/Cell row 1 column 1, value 5/),
    ).not.toBeNull();
    expect(
      screen.queryByLabelText(/Cell row 1 column 5, empty/),
    ).not.toBeNull();
  });

  it("never writes the previous game's board under the new game's key", () => {
    // On rematch the reset dispatch and the autosave effect share one
    // commit: the save ran with the OLD board serialized under the NEW
    // gameKey. It self-corrects a render later, but a tab killed in
    // that window resumes game 2 with game 1's cells.
    const props = baseProps();
    const { rerender } = render(<MultiplayerBoard {...props} />);

    const cell = screen.getByLabelText(/Cell row 1 column 1, empty/);
    fireEvent.click(cell);
    const five = screen.getAllByLabelText("5")[0]!;
    fireEvent.pointerDown(five, { pointerType: "touch" });
    fireEvent.pointerUp(five, { pointerType: "touch" });

    const setItem = vi.spyOn(Storage.prototype, "setItem");
    try {
      rerender(
        <MultiplayerBoard {...props} puzzle={PUZZLE_B} gameNumber={2} />,
      );
      const newKey = `sudoku_save_${multiplayerGameKey({ ...props, puzzle: PUZZLE_B, gameNumber: 2 })}`;
      const writesForNewGame = setItem.mock.calls.filter(
        ([key]) => key === newKey,
      );
      for (const [, raw] of writesForNewGame) {
        const saved = JSON.parse(raw as string);
        // Index 4 is PUZZLE_B's only hole; the old board holds a given
        // digit there, a fresh game-2 board holds ".".
        expect(saved.values[4]).toBe(".");
      }
    } finally {
      setItem.mockRestore();
    }
  });

  it("resets the timer when a rematch starts a new game", () => {
    vi.useFakeTimers();
    try {
      const props = baseProps();
      const { rerender } = render(<MultiplayerBoard {...props} />);

      act(() => {
        vi.advanceTimersByTime(65_000);
      });
      expect(screen.getByText("01:05")).toBeTruthy();

      // Rematch: gameNumber bumps and a new puzzle arrives. The board
      // resets in place — the clock must not carry game 1's time into
      // game 2 (it is also what gets recorded as the match time).
      rerender(
        <MultiplayerBoard {...props} puzzle={PUZZLE_B} gameNumber={2} />,
      );
      expect(screen.getByText("00:00")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("saves current multiplayer elapsed time before a display tick runs", () => {
    let now = 1_000;
    const props = baseProps();
    render(<MultiplayerBoard {...props} now={() => now} />);

    now += 2_500.5;
    act(() => window.dispatchEvent(new Event("pagehide")));

    expect(loadGame(multiplayerGameKey(props))?.timer).toBe(2.5005);
  });

  it("saves idle time on page exit and internal navigation", () => {
    vi.useFakeTimers();
    try {
      const props = baseProps();
      const { unmount } = render(<MultiplayerBoard {...props} />);
      act(() => vi.advanceTimersByTime(7000));
      act(() => window.dispatchEvent(new Event("pagehide")));
      expect(loadGame(multiplayerGameKey(props))?.timer).toBe(7);
      act(() => vi.advanceTimersByTime(3000));
      unmount();
      expect(loadGame(multiplayerGameKey(props))?.timer).toBe(10);
    } finally {
      vi.useRealTimers();
    }
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

      const saved = loadGame(multiplayerGameKey(props));
      expect(saved?.timer).toBeGreaterThanOrEqual(7);

      unmount();
      render(<MultiplayerBoard {...props} />);

      expect(screen.getByText(/^00:0[7-9]$/)).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the cell selected after a numpad tap places a value", () => {
    vi.useFakeTimers();
    try {
      render(<MultiplayerBoard {...baseProps()} />);

      const cell = screen.getByLabelText(/Cell row 1 column 1, empty/);
      fireEvent.click(cell);
      // Selection styling is applied via the cell-selected-glow class
      // (standard assist level uses the glow, paper uses a ring).
      expect(cell.className).toContain("cell-selected-glow");

      // A quick tap commits the value.
      const five = screen.getAllByLabelText("5")[0]!;
      fireEvent.pointerDown(five, { pointerType: "touch" });
      fireEvent.pointerUp(five, { pointerType: "touch" });

      // The value lands and the cell stays selected so the player can keep
      // working it without re-tapping the cell.
      const filledCell = screen.getByLabelText(/Cell row 1 column 1, value 5/);
      expect(filledCell.className).toContain("cell-selected-glow");
    } finally {
      vi.useRealTimers();
    }
  });

  it("deselects the cell and highlights the digit when a digit is tapped on a filled cell", () => {
    vi.useFakeTimers();
    try {
      render(<MultiplayerBoard {...baseProps()} />);

      // Select a filled cell, then tap a numpad digit — a tap can't
      // overwrite it, so it highlights the digit instead.
      const filled = screen.getByLabelText(/^Cell row 1 column 5, value 7/);
      fireEvent.click(filled);
      expect(filled.className).toContain("cell-selected-glow");

      const three = screen.getAllByLabelText("3")[0]!;
      fireEvent.pointerDown(three, { pointerType: "touch" });
      fireEvent.pointerUp(three, { pointerType: "touch" });

      // The cell is no longer selected, and the digit drives the board's
      // same-number highlight.
      expect(
        screen.getByLabelText(/^Cell row 1 column 5, value 7/).className,
      ).not.toContain("cell-selected-glow");
      expect(
        screen.getByLabelText(/^Cell row 2 column 7, value 3/).className,
      ).toContain("bg-cell-same-number");
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
      const cell04 = screen.getByLabelText(/^Cell row 1 column 5, value 7/);
      expect(cell04.className).toContain("bg-cell-same-number");

      // Tap "7" again → toggles the highlight off.
      fireEvent.pointerDown(seven, { pointerType: "touch" });
      fireEvent.pointerUp(seven, { pointerType: "touch" });
      const cell04After = screen.getByLabelText(
        /^Cell row 1 column 5, value 7/,
      );
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
        screen.getByLabelText(/^Cell row 1 column 5, value 7/).className,
      ).not.toContain("bg-cell-same-number");
      // (0,5)=8 in PUZZLE
      expect(
        screen.getByLabelText(/^Cell row 1 column 6, value 8/).className,
      ).toContain("bg-cell-same-number");
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears the digit highlight when a cell is selected", () => {
    vi.useFakeTimers();
    try {
      render(<MultiplayerBoard {...baseProps()} />);

      const seven = screen.getAllByLabelText("7")[0]!;
      fireEvent.pointerDown(seven, { pointerType: "touch" });
      fireEvent.pointerUp(seven, { pointerType: "touch" });
      expect(
        screen.getByLabelText(/^Cell row 1 column 5, value 7/).className,
      ).toContain("bg-cell-same-number");

      // Click an empty cell — selection clears the digit highlight so the
      // selection's own value (or lack of one) drives the board again.
      const empty = screen.getByLabelText(/Cell row 1 column 1, empty/);
      fireEvent.click(empty);

      expect(
        screen.getByLabelText(/^Cell row 1 column 5, value 7/).className,
      ).not.toContain("bg-cell-same-number");
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

      // Place a 5 in (0,0) with a numpad tap.
      const cell = screen.getByLabelText(/Cell row 1 column 1, empty/);
      fireEvent.click(cell);
      const five = screen.getAllByLabelText("5")[0]!;
      fireEvent.pointerDown(five, { pointerType: "touch" });
      fireEvent.pointerUp(five, { pointerType: "touch" });
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
      const cell = screen.getByLabelText(/Cell row 1 column 1, empty/);
      fireEvent.click(cell);
      // A numpad tap commits the value.
      const five = screen.getAllByLabelText("5")[0]!;
      fireEvent.pointerDown(five, { pointerType: "touch" });
      fireEvent.pointerUp(five, { pointerType: "touch" });

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

describe("MultiplayerBoard error highlighting", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("trusts the solution prop instead of recomputing it", () => {
    // Crash-reload bug: MultiplayerBoard used to recompute the solution
    // from the puzzle, but the solver returns a random valid solution
    // for non-unique puzzles. A reload could pick a different one and
    // flip every correct digit to red. Here the prop disagrees with the
    // genuine solve at (0,0) — the board must follow the prop.
    vi.useFakeTimers();
    try {
      const altSolution = `9${SOLVED.slice(1)}`;
      render(<MultiplayerBoard {...baseProps()} solution={altSolution} />);

      fireEvent.click(screen.getByLabelText(/Cell row 1 column 1, empty/));
      const five = screen.getAllByLabelText("5")[0]!;
      fireEvent.pointerDown(five, { pointerType: "touch" });
      fireEvent.pointerUp(five, { pointerType: "touch" });

      // 5 is the genuine solution value, but the prop says 9 — so it
      // renders as an error.
      const cell = screen.getByLabelText(/Cell row 1 column 1, value 5/);
      expect(cell.querySelector("span")?.className).toContain(
        "text-cell-conflict",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not flag a digit that matches the solution prop", () => {
    vi.useFakeTimers();
    try {
      render(<MultiplayerBoard {...baseProps()} />);

      fireEvent.click(screen.getByLabelText(/Cell row 1 column 1, empty/));
      const five = screen.getAllByLabelText("5")[0]!;
      fireEvent.pointerDown(five, { pointerType: "touch" });
      fireEvent.pointerUp(five, { pointerType: "touch" });

      const cell = screen.getByLabelText(/Cell row 1 column 1, value 5/);
      expect(cell.querySelector("span")?.className).not.toContain(
        "text-cell-conflict",
      );
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

  it("offers an optional rematch while the loser can keep solving", () => {
    const props = baseProps();
    render(
      <MultiplayerBoard
        {...props}
        gameOver={{ winnerId: "p2", winnerName: "Bob" }}
        rematchReady={["p2"]}
      />,
    );
    expect(screen.getByText(/Your current puzzle will end/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Cell row 1 column 1, empty/));
    fireEvent.keyDown(window, { key: "5" });
    expect(screen.getByLabelText(/Cell row 1 column 1, value 5/)).toBeTruthy();
    expect(props.onRematch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Accept rematch" }));
    expect(props.onRematch).toHaveBeenCalledOnce();
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
      const cell = screen.getByLabelText(/Cell row 1 column 1, empty/);
      fireEvent.click(cell);
      const five = screen.getAllByLabelText("5")[0]!;
      fireEvent.pointerDown(five, { pointerType: "touch" });
      fireEvent.pointerUp(five, { pointerType: "touch" });

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

  it("corrects the recorded outcome when the winner flips after a CRDT merge", () => {
    // Photo finish: both clients momentarily see themselves as winner,
    // then the merged doc settles on one. The optimistic record must be
    // corrected — otherwise both players' stores keep won:true forever.
    const props = baseProps();
    const { rerender } = render(
      <MultiplayerBoard
        {...props}
        gameOver={{ winnerId: "p1", winnerName: "Me" }}
      />,
    );
    expect(getMultiplayerStats()[0]?.won).toBe(true);

    rerender(
      <MultiplayerBoard
        {...props}
        gameOver={{ winnerId: "p2", winnerName: "Brave Otter" }}
      />,
    );

    const all = getMultiplayerStats();
    expect(all).toHaveLength(1);
    expect(all[0]?.won).toBe(false);
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

      const cell = screen.getByLabelText(/Cell row 1 column 1, empty/);
      fireEvent.click(cell);
      const five = screen.getAllByLabelText("5")[0]!;
      fireEvent.pointerDown(five, { pointerType: "touch" });
      fireEvent.pointerUp(five, { pointerType: "touch" });

      // Save should exist while the loser is still working on their board.
      const key = multiplayerGameKey(props);
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
    const boardCell = screen.getByLabelText(/^Cell row 1 column 1, empty/);

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
