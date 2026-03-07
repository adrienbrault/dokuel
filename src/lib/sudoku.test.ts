import { describe, expect, it } from "vitest";
import {
	generatePuzzle,
	getConflicts,
	isBoardComplete,
	parsePuzzle,
	solvePuzzle,
} from "./sudoku.ts";
import type { Board } from "./types.ts";

describe("generatePuzzle", () => {
	it("returns an 81-character string", () => {
		const puzzle = generatePuzzle("medium");
		expect(puzzle).toHaveLength(81);
	});

	it("contains only digits 0-9 and dots for empty cells", () => {
		const puzzle = generatePuzzle("medium");
		expect(puzzle).toMatch(/^[1-9.]{81}$/);
	});

	it("has more clues for easier difficulties", () => {
		const easy = generatePuzzle("easy");
		const expert = generatePuzzle("expert");
		const easyClues = easy.replace(/\./g, "").length;
		const expertClues = expert.replace(/\./g, "").length;
		expect(easyClues).toBeGreaterThan(expertClues);
	});

	it("generates different puzzles on each call", () => {
		const a = generatePuzzle("medium");
		const b = generatePuzzle("medium");
		expect(a).not.toBe(b);
	});
});

describe("solvePuzzle", () => {
	it("returns a valid 81-character solution", () => {
		const puzzle = generatePuzzle("medium");
		const solution = solvePuzzle(puzzle);
		expect(solution).toHaveLength(81);
		expect(solution).toMatch(/^[1-9]{81}$/);
	});

	it("solution contains all digits 1-9 in each row", () => {
		const puzzle = generatePuzzle("easy");
		const solution = solvePuzzle(puzzle);
		for (let row = 0; row < 9; row++) {
			const digits = solution.slice(row * 9, row * 9 + 9).split("");
			expect(new Set(digits).size).toBe(9);
		}
	});

	it("solution contains all digits 1-9 in each column", () => {
		const puzzle = generatePuzzle("easy");
		const solution = solvePuzzle(puzzle);
		for (let col = 0; col < 9; col++) {
			const digits: string[] = [];
			for (let row = 0; row < 9; row++) {
				digits.push(solution[row * 9 + col]);
			}
			expect(new Set(digits).size).toBe(9);
		}
	});

	it("preserves given clues from the puzzle", () => {
		const puzzle = generatePuzzle("easy");
		const solution = solvePuzzle(puzzle);
		for (let i = 0; i < 81; i++) {
			if (puzzle[i] !== ".") {
				expect(solution[i]).toBe(puzzle[i]);
			}
		}
	});
});

describe("parsePuzzle", () => {
	it("returns a 9x9 board", () => {
		const puzzle = generatePuzzle("easy");
		const board = parsePuzzle(puzzle);
		expect(board).toHaveLength(9);
		for (const row of board) {
			expect(row).toHaveLength(9);
		}
	});

	it("marks given cells correctly", () => {
		const puzzle = generatePuzzle("easy");
		const board = parsePuzzle(puzzle);
		for (let row = 0; row < 9; row++) {
			for (let col = 0; col < 9; col++) {
				const char = puzzle[row * 9 + col];
				if (char !== ".") {
					expect(board[row][col].isGiven).toBe(true);
					expect(board[row][col].value).toBe(Number(char));
				} else {
					expect(board[row][col].isGiven).toBe(false);
					expect(board[row][col].value).toBeNull();
				}
			}
		}
	});

	it("initializes empty notes for all cells", () => {
		const puzzle = generatePuzzle("easy");
		const board = parsePuzzle(puzzle);
		for (const row of board) {
			for (const cell of row) {
				expect(cell.notes).toBeInstanceOf(Set);
				expect(cell.notes.size).toBe(0);
			}
		}
	});
});

describe("getConflicts", () => {
	it("returns empty set when no conflicts", () => {
		const puzzle = generatePuzzle("easy");
		const solution = solvePuzzle(puzzle);
		const board = parsePuzzle(solution); // fully solved = no conflicts
		const conflicts = getConflicts(board);
		expect(conflicts.size).toBe(0);
	});

	it("detects row conflict", () => {
		const board = makeEmptyBoard();
		board[0][0].value = 5;
		board[0][4].value = 5;
		const conflicts = getConflicts(board);
		expect(conflicts.has("0,0")).toBe(true);
		expect(conflicts.has("0,4")).toBe(true);
	});

	it("detects column conflict", () => {
		const board = makeEmptyBoard();
		board[0][0].value = 3;
		board[5][0].value = 3;
		const conflicts = getConflicts(board);
		expect(conflicts.has("0,0")).toBe(true);
		expect(conflicts.has("5,0")).toBe(true);
	});

	it("detects box conflict", () => {
		const board = makeEmptyBoard();
		board[0][0].value = 7;
		board[2][2].value = 7;
		const conflicts = getConflicts(board);
		expect(conflicts.has("0,0")).toBe(true);
		expect(conflicts.has("2,2")).toBe(true);
	});

	it("does not flag non-conflicting cells", () => {
		const board = makeEmptyBoard();
		board[0][0].value = 1;
		board[0][1].value = 2;
		board[1][0].value = 3;
		const conflicts = getConflicts(board);
		expect(conflicts.size).toBe(0);
	});
});

describe("isBoardComplete", () => {
	it("returns true for a fully solved board", () => {
		const puzzle = generatePuzzle("easy");
		const solution = solvePuzzle(puzzle);
		const board = parsePuzzle(solution);
		expect(isBoardComplete(board)).toBe(true);
	});

	it("returns false when cells are empty", () => {
		const puzzle = generatePuzzle("easy");
		const board = parsePuzzle(puzzle);
		expect(isBoardComplete(board)).toBe(false);
	});

	it("returns false when there are conflicts even if all filled", () => {
		const board = makeEmptyBoard();
		// Fill all cells with 1 — lots of conflicts
		for (let r = 0; r < 9; r++) {
			for (let c = 0; c < 9; c++) {
				board[r][c].value = 1;
			}
		}
		expect(isBoardComplete(board)).toBe(false);
	});
});

function makeEmptyBoard(): Board {
	return Array.from({ length: 9 }, () =>
		Array.from({ length: 9 }, () => ({
			value: null,
			isGiven: false,
			notes: new Set<number>(),
		})),
	);
}
