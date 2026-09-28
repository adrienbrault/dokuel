import { describe, expect, it } from "vitest";
import type { DigitDragState } from "../hooks/useDigitDrag.ts";
import { cellKey, parsePuzzle } from "../lib/sudoku.ts";
import { deriveCellVisuals } from "./scene-state.ts";

/** Board with givens placed at each `[row, col, value]` triple. */
function boardWith(...placements: [number, number, number][]) {
  const chars = ".".repeat(81).split("");
  for (const [row, col, value] of placements) {
    chars[row * 9 + col] = String(value);
  }
  return parsePuzzle(chars.join(""));
}

const EMOJI = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

function base(over: Partial<Parameters<typeof deriveCellVisuals>[0]> = {}) {
  return deriveCellVisuals({
    board: boardWith([4, 4, 5]),
    selectedCell: null,
    conflicts: new Set<number>(),
    assistLevel: "standard",
    digitMode: "off",
    emoji: EMOJI,
    reducedMotion: false,
    hover: null,
    completed: false,
    ...over,
  });
}

describe("deriveCellVisuals", () => {
  it("returns 81 cells indexed row-major", () => {
    const cells = base();
    expect(cells).toHaveLength(81);
    expect(cells[4 * 9 + 4]!.value).toBe(5);
    expect(cells[4 * 9 + 4]!.isGiven).toBe(true);
    expect(cells[0]!.state).toBe("idle");
  });

  it("marks selection, row/col/box highlight and same-number matches", () => {
    const cells = base({ selectedCell: { row: 4, col: 4 } });
    expect(cells[4 * 9 + 4]!.state).toBe("selected");
    // Same box / row / column peers highlight; a far cell stays idle.
    expect(cells[3 * 9 + 3]!.state).toBe("highlight");
    expect(cells[4 * 9 + 0]!.state).toBe("highlight");
    expect(cells[0 * 9 + 4]!.state).toBe("highlight");
    expect(cells[0]!.state).toBe("idle");
  });

  it("falls back to the highlighted digit when nothing is selected", () => {
    const cells = base({ highlightedDigit: 5 });
    expect(cells[4 * 9 + 4]!.state).toBe("same");
    expect(cells[0]!.state).toBe("idle");
  });

  it("derives full-assist exclusion bands for the active digit", () => {
    const cells = base({
      board: boardWith([4, 4, 5], [0, 8, 5]),
      assistLevel: "full",
      selectedCell: { row: 4, col: 4 },
    });
    // Column 8 holds another 5, so a peer-highlighted cell there — one
    // the selection does not reach — becomes an exclusion band.
    expect(cells[1 * 9 + 8]!.state).toBe("matchRowCol");
    expect(cells[0 * 9 + 8]!.state).toBe("same");
    expect(cells[4 * 9 + 4]!.state).toBe("selected");
    expect(cells[6 * 9 + 6]!.state).toBe("idle");
  });

  it("orders state precedence the way the DOM paints it", () => {
    const cells = base({
      selectedCell: { row: 4, col: 4 },
      conflicts: new Set([cellKey(4, 4), cellKey(0, 0)]),
      hintCells: new Set([cellKey(0, 0), cellKey(1, 1)]),
      highlightedDigit: 5,
    });
    // selected beats conflict, conflict beats hint, hint beats same-number.
    expect(cells[4 * 9 + 4]!.state).toBe("selected");
    expect(cells[0]!.state).toBe("conflict");
    expect(cells[1 * 9 + 1]!.state).toBe("hint");
  });

  it("keeps conflict as an ink channel on entered values only", () => {
    const board = boardWith([0, 0, 2]);
    board[4]![4]!.value = 5;
    board[4]![4]!.isGiven = false;
    const cells = base({
      board,
      conflicts: new Set([cellKey(4, 4), cellKey(0, 0)]),
    });
    expect(cells[4 * 9 + 4]!.ink).toBe("conflict");
    expect(cells[4 * 9 + 4]!.state).toBe("conflict");
    // A given keeps its clue ink — the tint alone marks the collision,
    // exactly as the DOM keeps text-cell-given on a conflicted clue.
    expect(cells[0]!.ink).toBe("given");
    expect(cells[0]!.state).toBe("conflict");
    expect(cells[1]!.ink).toBe("user");
  });

  it("ignores highlight and same-number in paper mode", () => {
    const cells = base({
      assistLevel: "paper",
      selectedCell: { row: 4, col: 4 },
    });
    expect(cells[4 * 9 + 4]!.state).toBe("idle");
    expect(cells[3 * 9 + 3]!.state).toBe("idle");
  });

  it("carries multi-selection as selected", () => {
    const cells = base({
      selectedCells: new Set([cellKey(0, 0), cellKey(0, 1)]),
    });
    expect(cells[0]!.state).toBe("selected");
    expect(cells[1]!.state).toBe("selected");
  });

  it("carries the in-flight drag as source, target and ghost digit", () => {
    const drag: DigitDragState = {
      digit: 7,
      source: { kind: "cell", row: 8, col: 8 },
      x: 0,
      y: 0,
      target: { row: 0, col: 0 },
      invalidTarget: false,
      mode: "note",
      lift: 0,
    };
    const cells = base({ dragState: drag });
    expect(cells[8 * 9 + 8]!.dragSource).toBe(true);
    expect(cells[0]!.dropTarget).toBe("valid");
    expect(cells[0]!.dropMode).toBe("note");
    expect(cells[0]!.dropDigit).toBe(7);
  });

  it("marks an invalid drop target", () => {
    const drag: DigitDragState = {
      digit: 7,
      source: { kind: "numpad" },
      x: 0,
      y: 0,
      target: { row: 4, col: 4 },
      invalidTarget: true,
      mode: "value",
      lift: 0,
    };
    const cells = base({ dragState: drag });
    expect(cells[4 * 9 + 4]!.dropTarget).toBe("invalid");
    expect(cells[4 * 9 + 4]!.dropDigit).toBeNull();
  });

  it("flags the charging cell only while its own cell is selected", () => {
    const selected = base({
      selectedCell: { row: 4, col: 4 },
      chargingDigit: 3,
    });
    expect(selected[4 * 9 + 4]!.charging).toBe(true);
    const unselected = base({ chargingDigit: 3 });
    expect(unselected[4 * 9 + 4]!.charging).toBe(false);
  });

  it("stagger-delays given reveal and leaves blanks and no-animation alone", () => {
    const cells = base({ animateReveal: true });
    expect(cells[4 * 9 + 4]!.revealDelayMs).toBe((4 * 9 + 4) * 6);
    expect(cells[0]!.revealDelayMs).toBeNull();
    const still = base();
    expect(still[4 * 9 + 4]!.revealDelayMs).toBeNull();
  });

  it("passes hover, digit mode, emoji and motion preferences through", () => {
    const cells = base({ hover: cellKey(2, 2), digitMode: "emoji" });
    expect(cells[2 * 9 + 2]!.hover).toBe(true);
    expect(cells[0]!.hover).toBe(false);
    expect(cells[4 * 9 + 4]!.emoji).toBe("5");
    expect(cells[0]!.emoji).toBeNull();
  });

  it("lists pencil notes in ascending digit order", () => {
    const board = boardWith();
    board[4]![4]!.notes = new Set([9, 1, 5]);
    const cells = base({ board });
    expect(cells[4 * 9 + 4]!.notes).toEqual([1, 5, 9]);
  });

  it("keeps the emoji empty while digits draw as digits", () => {
    // A cell that names an emoji in a numeral mode asks the atlas for a
    // glyph it does not hold, and lands on the wrong character.
    const cells = base({ digitMode: "off" });
    expect(cells[4 * 9 + 4]!.value).toBe(5);
    expect(cells[4 * 9 + 4]!.emoji).toBeNull();
  });
});
