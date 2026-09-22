import { describe, expect, it } from "vitest";
import { type DemoStep, demoFrame } from "./landing-demo.ts";

// Row 0 holds 1-8, so the empty cell at the end of it takes a 9.
const PUZZLE = `12345678${".".repeat(73)}`;

describe("demoFrame", () => {
  it("replays a cell tap then a number tap into a placed value", () => {
    const script: DemoStep[] = [
      { action: { kind: "select", row: 0, col: 8 }, ms: 900, caption: "Pick" },
      { action: { kind: "tap", digit: 9 }, ms: 900, caption: "Fill" },
    ];

    const picked = demoFrame(script, PUZZLE, 0);
    const filled = demoFrame(script, PUZZLE, 1);

    expect(picked.selectedCell).toEqual({ row: 0, col: 8 });
    expect(picked.board[0]![8]!.value).toBeNull();
    expect(picked.finger).toEqual({ kind: "cell", row: 0, col: 8 });
    expect(picked.caption).toBe("Pick");
    expect(filled.board[0]![8]!.value).toBe(9);
    expect(filled.finger).toEqual({ kind: "key", digit: 9 });
    expect(filled.activeKey).toBe(9);
    expect(filled.caption).toBe("Fill");
  });

  it("stacks held digits as pencil notes, keeping the cell selected", () => {
    const script: DemoStep[] = [
      { action: { kind: "select", row: 4, col: 4 }, ms: 900, caption: "Pick" },
      { action: { kind: "hold", digit: 3 }, ms: 900, caption: "Hold" },
      { action: { kind: "hold", digit: 7 }, ms: 900, caption: "Hold" },
    ];

    const frame = demoFrame(script, PUZZLE, 2);

    expect(frame.board[4]![4]!.value).toBeNull();
    expect([...frame.board[4]![4]!.notes].sort()).toEqual([3, 7]);
    expect(frame.selectedCell).toEqual({ row: 4, col: 4 });
    expect(frame.chargingDigit).toBe(7);
    expect(frame.finger).toEqual({ kind: "key", digit: 7 });
  });

  it("skims the numpad into a board-wide highlight, dropping the selection", () => {
    const script: DemoStep[] = [
      { action: { kind: "select", row: 4, col: 4 }, ms: 900, caption: "Pick" },
      { action: { kind: "skim", digit: 2 }, ms: 400, caption: "Skim" },
      { action: { kind: "skim", digit: 3 }, ms: 400, caption: "Skim" },
    ];

    const frame = demoFrame(script, PUZZLE, 2);

    expect(frame.selectedCell).toBeNull();
    expect(frame.highlightedDigit).toBe(3);
    expect(frame.activeKey).toBe(3);
    expect(frame.finger).toEqual({ kind: "key", digit: 3 });
  });

  it("previews a dragged digit over a cell half and commits it on drop", () => {
    const over = (mode: "value" | "note") =>
      ({ kind: "drag", digit: 5, row: 2, col: 2, mode }) as const;
    const script: DemoStep[] = [
      { action: over("value"), ms: 900, caption: "Top half" },
      { action: over("note"), ms: 900, caption: "Bottom half" },
      {
        action: { kind: "drop", digit: 5, row: 2, col: 2, mode: "note" },
        ms: 900,
        caption: "Drop",
      },
      { action: over("value"), ms: 900, caption: "Top half" },
      {
        action: { kind: "drop", digit: 5, row: 3, col: 3, mode: "value" },
        ms: 900,
        caption: "Drop",
      },
    ];

    const hovering = demoFrame(script, PUZZLE, 1);
    const noted = demoFrame(script, PUZZLE, 2);
    const placed = demoFrame(script, PUZZLE, 4);

    expect(hovering.drag).toEqual({ digit: 5, row: 2, col: 2, mode: "note" });
    expect(hovering.board[2]![2]!.notes.size).toBe(0);
    expect(hovering.finger).toEqual({
      kind: "cell",
      row: 2,
      col: 2,
      half: "bottom",
    });
    expect(noted.drag).toBeNull();
    expect([...noted.board[2]![2]!.notes]).toEqual([5]);
    expect(placed.board[3]![3]!.value).toBe(5);
    expect(placed.selectedCell).toEqual({ row: 3, col: 3 });
  });
});
