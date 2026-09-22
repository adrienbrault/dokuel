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
});
