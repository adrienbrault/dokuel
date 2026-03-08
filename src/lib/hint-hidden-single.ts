import type { HintExplanation } from "./hint-engine.ts";
import type { Board, Position } from "./types.ts";

function getCandidates(board: Board, row: number, col: number): Set<number> {
  const used = new Set<number>();
  for (let c = 0; c < 9; c++) {
    const v = board[row]![c]!.value;
    if (v !== null) used.add(v);
  }
  for (let r = 0; r < 9; r++) {
    const v = board[r]![col]!.value;
    if (v !== null) used.add(v);
  }
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      const v = board[r]![c]!.value;
      if (v !== null) used.add(v);
    }
  }
  const candidates = new Set<number>();
  for (let d = 1; d <= 9; d++) {
    if (!used.has(d)) candidates.add(d);
  }
  return candidates;
}

function groupName(type: "row" | "col" | "box", index: number): string {
  if (type === "row") return `row ${index + 1}`;
  if (type === "col") return `column ${index + 1}`;
  return `box ${index + 1}`;
}

function findEliminatorsForDigit(
  board: Board,
  row: number,
  col: number,
  digit: number,
  excludeGroupType: "row" | "col" | "box",
  excludeGroupIndex: number,
): Position[] {
  const eliminators: Position[] = [];
  if (excludeGroupType !== "row" || excludeGroupIndex !== row) {
    for (let c = 0; c < 9; c++) {
      if (c !== col && board[row]![c]!.value === digit) {
        eliminators.push({ row, col: c });
      }
    }
  }
  if (excludeGroupType !== "col" || excludeGroupIndex !== col) {
    for (let r = 0; r < 9; r++) {
      if (r !== row && board[r]![col]!.value === digit) {
        eliminators.push({ row: r, col });
      }
    }
  }
  const boxIndex = Math.floor(row / 3) * 3 + Math.floor(col / 3);
  if (excludeGroupType !== "box" || excludeGroupIndex !== boxIndex) {
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;
    for (let r = boxRow; r < boxRow + 3; r++) {
      for (let c = boxCol; c < boxCol + 3; c++) {
        if ((r !== row || c !== col) && board[r]![c]!.value === digit) {
          eliminators.push({ row: r, col: c });
        }
      }
    }
  }
  return eliminators;
}

function findHiddenSingleInGroup(
  board: Board,
  type: "row" | "col" | "box",
  index: number,
): HintExplanation | null {
  const emptyCells: { row: number; col: number; candidates: Set<number> }[] =
    [];

  if (type === "row") {
    for (let c = 0; c < 9; c++) {
      if (board[index]![c]!.value === null) {
        emptyCells.push({
          row: index,
          col: c,
          candidates: getCandidates(board, index, c),
        });
      }
    }
  } else if (type === "col") {
    for (let r = 0; r < 9; r++) {
      if (board[r]![index]!.value === null) {
        emptyCells.push({
          row: r,
          col: index,
          candidates: getCandidates(board, r, index),
        });
      }
    }
  } else {
    const boxRow = Math.floor(index / 3) * 3;
    const boxCol = (index % 3) * 3;
    for (let r = boxRow; r < boxRow + 3; r++) {
      for (let c = boxCol; c < boxCol + 3; c++) {
        if (board[r]![c]!.value === null) {
          emptyCells.push({
            row: r,
            col: c,
            candidates: getCandidates(board, r, c),
          });
        }
      }
    }
  }

  for (let d = 1; d <= 9; d++) {
    const possibleCells = emptyCells.filter((c) => c.candidates.has(d));
    if (possibleCells.length === 1) {
      const cell = possibleCells[0]!;
      if (cell.candidates.size === 1) continue;

      const name = groupName(type, index);
      const related: Position[] = [];
      if (type === "row") {
        for (let c = 0; c < 9; c++) {
          if (c !== cell.col && board[index]![c]!.value !== null) {
            related.push({ row: index, col: c });
          }
        }
      } else if (type === "col") {
        for (let r = 0; r < 9; r++) {
          if (r !== cell.row && board[r]![index]!.value !== null) {
            related.push({ row: r, col: index });
          }
        }
      } else {
        const boxRow = Math.floor(index / 3) * 3;
        const boxCol = (index % 3) * 3;
        for (let r = boxRow; r < boxRow + 3; r++) {
          for (let c = boxCol; c < boxCol + 3; c++) {
            if (
              (r !== cell.row || c !== cell.col) &&
              board[r]![c]!.value !== null
            ) {
              related.push({ row: r, col: c });
            }
          }
        }
      }

      for (const other of emptyCells) {
        if (other === cell) continue;
        if (!other.candidates.has(d)) {
          const eliminators = findEliminatorsForDigit(
            board,
            other.row,
            other.col,
            d,
            type,
            index,
          );
          for (const e of eliminators) {
            related.push(e);
          }
        }
      }

      return {
        position: { row: cell.row, col: cell.col },
        value: d,
        technique: "hidden-single",
        explanation: `In ${name}, ${d} can only go here. The other empty cells in this ${type === "box" ? "box" : type} can't contain ${d} because of conflicts in their rows, columns, or boxes.`,
        relatedCells: related,
      };
    }
  }
  return null;
}

export function findHiddenSingle(board: Board): HintExplanation | null {
  for (let row = 0; row < 9; row++) {
    const result = findHiddenSingleInGroup(board, "row", row);
    if (result) return result;
  }
  for (let col = 0; col < 9; col++) {
    const result = findHiddenSingleInGroup(board, "col", col);
    if (result) return result;
  }
  for (let box = 0; box < 9; box++) {
    const result = findHiddenSingleInGroup(board, "box", box);
    if (result) return result;
  }
  return null;
}
