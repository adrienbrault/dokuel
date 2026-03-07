import * as sudokuLib from "sudoku";
import type { Board, Cell, Difficulty } from "./types.ts";

const DIFFICULTY_CLUES: Record<Difficulty, { min: number; max: number }> = {
	easy: { min: 40, max: 50 },
	medium: { min: 32, max: 39 },
	hard: { min: 26, max: 31 },
	expert: { min: 20, max: 25 },
};

/**
 * Generate a puzzle string (81 chars, 1-9 for clues, . for empty).
 * Removes extra clues to match desired difficulty range.
 */
export function generatePuzzle(difficulty: Difficulty): string {
	const { min, max } = DIFFICULTY_CLUES[difficulty];
	const targetClues = min + Math.floor(Math.random() * (max - min + 1));

	// sudoku lib uses 0-8, null for empty
	const raw = sudokuLib.makepuzzle() as (number | null)[];

	// Get indices of given clues
	const givenIndices: number[] = [];
	for (let i = 0; i < 81; i++) {
		if (raw[i] !== null) givenIndices.push(i);
	}

	// Remove clues if we have too many
	while (givenIndices.length > targetClues) {
		const removeIdx = Math.floor(Math.random() * givenIndices.length);
		const cellIdx = givenIndices[removeIdx];
		raw[cellIdx] = null;
		givenIndices.splice(removeIdx, 1);
	}

	// Convert to our format: 1-9 for values, . for empty
	return raw.map((v) => (v === null ? "." : String(v + 1))).join("");
}

/**
 * Solve a puzzle string. Returns 81-char solution string (all 1-9).
 */
export function solvePuzzle(puzzle: string): string {
	// Convert our format back to sudoku lib format (0-8, null)
	const raw = puzzle.split("").map((c) => (c === "." ? null : Number(c) - 1));
	const solution = sudokuLib.solvepuzzle(raw) as number[];
	return solution.map((v) => String(v + 1)).join("");
}

/**
 * Parse a puzzle string into a 9x9 Board.
 */
export function parsePuzzle(puzzle: string): Board {
	const board: Board = [];
	for (let row = 0; row < 9; row++) {
		const cells: Cell[] = [];
		for (let col = 0; col < 9; col++) {
			const char = puzzle[row * 9 + col];
			const isEmpty = char === ".";
			cells.push({
				value: isEmpty ? null : Number(char),
				isGiven: !isEmpty,
				notes: new Set<number>(),
			});
		}
		board.push(cells);
	}
	return board;
}

/**
 * Get all conflicting cell positions as a Set of "row,col" strings.
 * A conflict = same non-null value in the same row, column, or 3x3 box.
 */
export function getConflicts(board: Board): Set<string> {
	const conflicts = new Set<string>();

	for (let row = 0; row < 9; row++) {
		for (let col = 0; col < 9; col++) {
			const value = board[row][col].value;
			if (value === null) continue;

			// Check row
			for (let c = 0; c < 9; c++) {
				if (c !== col && board[row][c].value === value) {
					conflicts.add(`${row},${col}`);
					conflicts.add(`${row},${c}`);
				}
			}

			// Check column
			for (let r = 0; r < 9; r++) {
				if (r !== row && board[r][col].value === value) {
					conflicts.add(`${row},${col}`);
					conflicts.add(`${r},${col}`);
				}
			}

			// Check 3x3 box
			const boxRow = Math.floor(row / 3) * 3;
			const boxCol = Math.floor(col / 3) * 3;
			for (let r = boxRow; r < boxRow + 3; r++) {
				for (let c = boxCol; c < boxCol + 3; c++) {
					if (r !== row || c !== col) {
						if (board[r][c].value === value) {
							conflicts.add(`${row},${col}`);
							conflicts.add(`${r},${c}`);
						}
					}
				}
			}
		}
	}

	return conflicts;
}

/**
 * Check if a board is complete: all cells filled and no conflicts.
 */
export function isBoardComplete(board: Board): boolean {
	for (const row of board) {
		for (const cell of row) {
			if (cell.value === null) return false;
		}
	}
	return getConflicts(board).size === 0;
}
