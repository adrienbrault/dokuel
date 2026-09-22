import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { parsePuzzle } from "../lib/sudoku.ts";
import { ReplayBoard } from "./ReplayBoard.tsx";

const PUZZLE =
  "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";
const SOLUTION =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

describe("ReplayBoard", () => {
  it("shows digits, notes, mistakes and the latest change", () => {
    const board = parsePuzzle(PUZZLE);
    board[0]![2]!.value = 4;
    board[0]![3]!.value = 1;
    board[0]![5]!.notes = new Set([2, 8]);

    render(
      <ReplayBoard
        board={board}
        solution={SOLUTION}
        changed={new Set([3])}
        label="Alice"
      />,
    );

    expect(screen.getByLabelText("Row 1 column 3, value 4").dataset.state).toBe(
      "user",
    );
    expect(screen.getByLabelText("Row 1 column 4, value 1").dataset.state).toBe(
      "mistake",
    );
    expect(
      screen.getByLabelText("Row 1 column 4, value 1").dataset.changed,
    ).toBe("true");
    expect(screen.getByLabelText("Row 1 column 6, notes 2 8")).toBeTruthy();
    expect(screen.getByLabelText("Row 1 column 1, value 5").dataset.state).toBe(
      "given",
    );
  });
});
