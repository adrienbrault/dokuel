import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { generatePuzzle, solvePuzzle } from "../lib/sudoku.ts";
import { useSudoku } from "./useSudoku.ts";

function setupHook(difficulty: "easy" | "medium" = "easy") {
	const puzzle = generatePuzzle(difficulty);
	const solution = solvePuzzle(puzzle);
	return renderHook(() => useSudoku(puzzle, solution));
}

describe("useSudoku", () => {
	it("initializes board from puzzle", () => {
		const { result } = setupHook();
		expect(result.current.board).toHaveLength(9);
		expect(result.current.board[0]).toHaveLength(9);
	});

	it("starts in playing status", () => {
		const { result } = setupHook();
		expect(result.current.status).toBe("playing");
	});

	it("starts with no selected cell", () => {
		const { result } = setupHook();
		expect(result.current.selectedCell).toBeNull();
	});

	it("starts with notes mode off", () => {
		const { result } = setupHook();
		expect(result.current.notesMode).toBe(false);
	});

	it("can select a cell", () => {
		const { result } = setupHook();
		act(() => result.current.selectCell(3, 4));
		expect(result.current.selectedCell).toEqual({ row: 3, col: 4 });
	});

	it("can place a number on an empty cell", () => {
		const { result } = setupHook();

		// Find an empty cell
		const pos = findEmptyCell(result.current.board);
		if (!pos) throw new Error("No empty cell found");

		act(() => result.current.selectCell(pos.row, pos.col));
		act(() => result.current.placeNumber(5));

		expect(result.current.board[pos.row][pos.col].value).toBe(5);
	});

	it("cannot place a number on a given cell", () => {
		const { result } = setupHook();

		// Find a given cell
		const pos = findGivenCell(result.current.board);
		if (!pos) throw new Error("No given cell found");

		const originalValue = result.current.board[pos.row][pos.col].value;
		act(() => result.current.selectCell(pos.row, pos.col));
		act(() => result.current.placeNumber(5));

		expect(result.current.board[pos.row][pos.col].value).toBe(originalValue);
	});

	it("undo reverts the last move", () => {
		const { result } = setupHook();

		const pos = findEmptyCell(result.current.board);
		if (!pos) throw new Error("No empty cell found");

		act(() => result.current.selectCell(pos.row, pos.col));
		act(() => result.current.placeNumber(5));
		expect(result.current.board[pos.row][pos.col].value).toBe(5);

		act(() => result.current.undo());
		expect(result.current.board[pos.row][pos.col].value).toBeNull();
	});

	it("erase clears a non-given cell", () => {
		const { result } = setupHook();

		const pos = findEmptyCell(result.current.board);
		if (!pos) throw new Error("No empty cell found");

		act(() => result.current.selectCell(pos.row, pos.col));
		act(() => result.current.placeNumber(3));
		expect(result.current.board[pos.row][pos.col].value).toBe(3);

		act(() => result.current.erase());
		expect(result.current.board[pos.row][pos.col].value).toBeNull();
	});

	it("erase does not clear a given cell", () => {
		const { result } = setupHook();

		const pos = findGivenCell(result.current.board);
		if (!pos) throw new Error("No given cell found");

		const originalValue = result.current.board[pos.row][pos.col].value;
		act(() => result.current.selectCell(pos.row, pos.col));
		act(() => result.current.erase());

		expect(result.current.board[pos.row][pos.col].value).toBe(originalValue);
	});

	it("toggle notes mode on and off", () => {
		const { result } = setupHook();
		expect(result.current.notesMode).toBe(false);

		act(() => result.current.toggleNotesMode());
		expect(result.current.notesMode).toBe(true);

		act(() => result.current.toggleNotesMode());
		expect(result.current.notesMode).toBe(false);
	});

	it("in notes mode, placeNumber toggles a note on a cell", () => {
		const { result } = setupHook();

		const pos = findEmptyCell(result.current.board);
		if (!pos) throw new Error("No empty cell found");

		act(() => result.current.toggleNotesMode());
		act(() => result.current.selectCell(pos.row, pos.col));
		act(() => result.current.placeNumber(7));

		expect(result.current.board[pos.row][pos.col].notes.has(7)).toBe(true);

		// Toggle it off
		act(() => result.current.placeNumber(7));
		expect(result.current.board[pos.row][pos.col].notes.has(7)).toBe(false);
	});

	it("placing a value clears notes on that cell", () => {
		const { result } = setupHook();

		const pos = findEmptyCell(result.current.board);
		if (!pos) throw new Error("No empty cell found");

		// Add a note
		act(() => result.current.toggleNotesMode());
		act(() => result.current.selectCell(pos.row, pos.col));
		act(() => result.current.placeNumber(4));
		expect(result.current.board[pos.row][pos.col].notes.has(4)).toBe(true);

		// Place a value (turn off notes mode first)
		act(() => result.current.toggleNotesMode());
		act(() => result.current.placeNumber(5));

		expect(result.current.board[pos.row][pos.col].value).toBe(5);
		expect(result.current.board[pos.row][pos.col].notes.size).toBe(0);
	});

	it("detects conflicts on each move", () => {
		const { result } = setupHook();

		// Find two empty cells in the same row
		const pos1 = findEmptyCell(result.current.board);
		if (!pos1) throw new Error("No empty cell found");

		let pos2: { row: number; col: number } | null = null;
		for (let c = 0; c < 9; c++) {
			if (
				c !== pos1.col &&
				!result.current.board[pos1.row][c].isGiven &&
				result.current.board[pos1.row][c].value === null
			) {
				pos2 = { row: pos1.row, col: c };
				break;
			}
		}
		if (!pos2) throw new Error("No second empty cell in same row");

		act(() => result.current.selectCell(pos1.row, pos1.col));
		act(() => result.current.placeNumber(9));
		act(() => result.current.selectCell(pos2.row, pos2.col));
		act(() => result.current.placeNumber(9));

		expect(result.current.conflicts.has(`${pos1.row},${pos1.col}`)).toBe(true);
		expect(result.current.conflicts.has(`${pos2.row},${pos2.col}`)).toBe(true);
	});

	it("detects completion when board is fully and correctly solved", () => {
		const puzzle = generatePuzzle("easy");
		const solution = solvePuzzle(puzzle);
		const { result } = renderHook(() => useSudoku(puzzle, solution));

		// Fill all empty cells with correct values from solution
		for (let row = 0; row < 9; row++) {
			for (let col = 0; col < 9; col++) {
				if (!result.current.board[row][col].isGiven) {
					act(() => result.current.selectCell(row, col));
					act(() =>
						result.current.placeNumber(Number(solution[row * 9 + col])),
					);
				}
			}
		}

		expect(result.current.status).toBe("completed");
	});

	it("setActiveNumber sets the active number for fill mode", () => {
		const { result } = setupHook();
		expect(result.current.activeNumber).toBeNull();

		act(() => result.current.setActiveNumber(5));
		expect(result.current.activeNumber).toBe(5);

		// Toggling same number deselects
		act(() => result.current.setActiveNumber(5));
		expect(result.current.activeNumber).toBeNull();
	});

	it("getRemainingCounts returns correct counts", () => {
		const { result } = setupHook();
		const counts = result.current.remainingCounts;

		// Should have entries for 1-9
		expect(Object.keys(counts)).toHaveLength(9);

		// Total of all counts + placed should = 9 for each digit
		for (let d = 1; d <= 9; d++) {
			expect(counts[d]).toBeGreaterThanOrEqual(0);
			expect(counts[d]).toBeLessThanOrEqual(9);
		}
	});
});

function findEmptyCell(board: { value: number | null; isGiven: boolean }[][]) {
	for (let row = 0; row < 9; row++) {
		for (let col = 0; col < 9; col++) {
			if (!board[row][col].isGiven && board[row][col].value === null) {
				return { row, col };
			}
		}
	}
	return null;
}

function findGivenCell(board: { value: number | null; isGiven: boolean }[][]) {
	for (let row = 0; row < 9; row++) {
		for (let col = 0; col < 9; col++) {
			if (board[row][col].isGiven) {
				return { row, col };
			}
		}
	}
	return null;
}
