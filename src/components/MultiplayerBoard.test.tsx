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

  it("flushes the timer to localStorage on pagehide so a crash mid-think loses at most a second", () => {
    vi.useFakeTimers();
    try {
      const props = baseProps();
      render(<MultiplayerBoard {...props} />);

      // Tick the timer without ever touching the board so the regular
      // board-change autosave never runs.
      act(() => {
        vi.advanceTimersByTime(12000);
      });

      const key = `mp_${props.roomId}_${props.puzzle.slice(0, 12)}`;
      // The mount-time autosave fires before any tick, capturing timer: 0.
      expect(loadGame(key)?.timer).toBe(0);

      window.dispatchEvent(new Event("pagehide"));

      const saved = loadGame(key);
      expect(saved?.timer).toBeGreaterThanOrEqual(12);
    } finally {
      vi.useRealTimers();
    }
  });

  it("deselects the cell after a tap-only numpad note", () => {
    vi.useFakeTimers();
    try {
      render(<MultiplayerBoard {...baseProps()} />);

      const cell = screen.getByLabelText(/Cell row 1 column 1, empty/);
      fireEvent.click(cell);
      // Selection styling is applied via the cell-selected-glow class
      // (standard assist level uses the glow, paper uses a ring).
      expect(cell.className).toContain("cell-selected-glow");

      // Tap = note (instant on pointerdown). No hold timer expiration
      // before release, so the long-press digit must not fire.
      const five = screen.getAllByLabelText("5")[0]!;
      fireEvent.pointerDown(five, { pointerType: "touch" });
      fireEvent.pointerUp(five, { pointerType: "touch" });

      // Cell stays empty (note, not digit) and no longer carries selection.
      expect(
        screen.queryByLabelText(/Cell row 1 column 1, empty/),
      ).not.toBeNull();
      expect(cell.className).not.toContain("cell-selected-glow");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the cell selected after a tap+hold digit placement", () => {
    vi.useFakeTimers();
    try {
      render(<MultiplayerBoard {...baseProps()} />);

      const cell = screen.getByLabelText(/Cell row 1 column 1, empty/);
      fireEvent.click(cell);

      const five = screen.getAllByLabelText("5")[0]!;
      fireEvent.pointerDown(five, { pointerType: "touch" });
      act(() => {
        vi.advanceTimersByTime(500);
      });
      fireEvent.pointerUp(five, { pointerType: "touch" });

      // Digit landed and the cell remains selected so the player can
      // keep working it (e.g. erase + retry without re-tapping).
      const filledCell = screen.getByLabelText(/Cell row 1 column 1, value 5/);
      expect(filledCell.className).toContain("cell-selected-glow");
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
      // Numpad tap is now "note"; long-press is what commits a value.
      // MultiplayerBoard doesn't wire useKeyboard so we can't use the
      // keyboard path here — simulate the hold gesture instead.
      const five = screen.getAllByLabelText("5")[0]!;
      fireEvent.pointerDown(five, { pointerType: "touch" });
      act(() => {
        vi.advanceTimersByTime(500);
      });
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
