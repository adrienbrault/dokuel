import { useCallback, useMemo, useReducer } from "react";
import { getConflicts, isBoardComplete, parsePuzzle } from "../lib/sudoku.ts";
import type { Board, GameStatus, MoveAction, Position } from "../lib/types.ts";

type State = {
	board: Board;
	solution: string;
	status: GameStatus;
	selectedCell: Position | null;
	activeNumber: number | null;
	notesMode: boolean;
	history: MoveAction[];
	conflicts: Set<string>;
};

type Action =
	| { type: "SELECT_CELL"; row: number; col: number }
	| { type: "PLACE_NUMBER"; value: number }
	| { type: "ERASE" }
	| { type: "UNDO" }
	| { type: "TOGGLE_NOTES" }
	| { type: "SET_ACTIVE_NUMBER"; value: number };

function cloneBoard(board: Board): Board {
	return board.map((row) =>
		row.map((cell) => ({
			...cell,
			notes: new Set(cell.notes),
		})),
	);
}

function reducer(state: State, action: Action): State {
	switch (action.type) {
		case "SELECT_CELL": {
			return { ...state, selectedCell: { row: action.row, col: action.col } };
		}

		case "PLACE_NUMBER": {
			if (!state.selectedCell || state.status === "completed") return state;
			const { row, col } = state.selectedCell;
			const cell = state.board[row][col];
			if (cell.isGiven) return state;

			if (state.notesMode) {
				const board = cloneBoard(state.board);
				const notes = board[row][col].notes;
				const moveAction: MoveAction = {
					type: "toggleNote",
					position: { row, col },
					note: action.value,
				};
				if (notes.has(action.value)) {
					notes.delete(action.value);
				} else {
					notes.add(action.value);
				}
				return {
					...state,
					board,
					history: [...state.history, moveAction],
				};
			}

			const board = cloneBoard(state.board);
			const moveAction: MoveAction = {
				type: "place",
				position: { row, col },
				value: action.value,
				previousValue: cell.value,
				previousNotes: new Set(cell.notes),
			};
			board[row][col].value = action.value;
			board[row][col].notes = new Set();
			const conflicts = getConflicts(board);
			const complete = isBoardComplete(board);

			return {
				...state,
				board,
				conflicts,
				status: complete ? "completed" : state.status,
				history: [...state.history, moveAction],
			};
		}

		case "ERASE": {
			if (!state.selectedCell || state.status === "completed") return state;
			const { row, col } = state.selectedCell;
			const cell = state.board[row][col];
			if (cell.isGiven) return state;

			const board = cloneBoard(state.board);
			const moveAction: MoveAction = {
				type: "erase",
				position: { row, col },
				previousValue: cell.value,
				previousNotes: new Set(cell.notes),
			};
			board[row][col].value = null;
			board[row][col].notes = new Set();
			const conflicts = getConflicts(board);

			return {
				...state,
				board,
				conflicts,
				history: [...state.history, moveAction],
			};
		}

		case "UNDO": {
			if (state.history.length === 0 || state.status === "completed")
				return state;
			const history = state.history.slice(0, -1);
			const lastAction = state.history[state.history.length - 1];
			const board = cloneBoard(state.board);
			const { row, col } = lastAction.position;

			switch (lastAction.type) {
				case "place":
				case "erase": {
					board[row][col].value = lastAction.previousValue;
					board[row][col].notes = new Set(lastAction.previousNotes);
					break;
				}
				case "toggleNote": {
					const notes = board[row][col].notes;
					if (notes.has(lastAction.note)) {
						notes.delete(lastAction.note);
					} else {
						notes.add(lastAction.note);
					}
					break;
				}
			}

			const conflicts = getConflicts(board);
			return { ...state, board, conflicts, history };
		}

		case "TOGGLE_NOTES": {
			return { ...state, notesMode: !state.notesMode };
		}

		case "SET_ACTIVE_NUMBER": {
			return {
				...state,
				activeNumber: state.activeNumber === action.value ? null : action.value,
			};
		}

		default:
			return state;
	}
}

function initState(puzzle: string, solution: string): State {
	const board = parsePuzzle(puzzle);
	return {
		board,
		solution,
		status: "playing",
		selectedCell: null,
		activeNumber: null,
		notesMode: false,
		history: [],
		conflicts: new Set(),
	};
}

export function useSudoku(puzzle: string, solution: string) {
	const [state, dispatch] = useReducer(
		reducer,
		{ puzzle, solution },
		({ puzzle, solution }) => initState(puzzle, solution),
	);

	const selectCell = useCallback(
		(row: number, col: number) => dispatch({ type: "SELECT_CELL", row, col }),
		[],
	);

	const placeNumber = useCallback(
		(value: number) => dispatch({ type: "PLACE_NUMBER", value }),
		[],
	);

	const erase = useCallback(() => dispatch({ type: "ERASE" }), []);

	const undo = useCallback(() => dispatch({ type: "UNDO" }), []);

	const toggleNotesMode = useCallback(
		() => dispatch({ type: "TOGGLE_NOTES" }),
		[],
	);

	const setActiveNumber = useCallback(
		(value: number) => dispatch({ type: "SET_ACTIVE_NUMBER", value }),
		[],
	);

	const remainingCounts = useMemo(() => {
		const counts: Record<number, number> = {};
		for (let d = 1; d <= 9; d++) counts[d] = 9;
		for (const row of state.board) {
			for (const cell of row) {
				if (cell.value !== null && cell.value >= 1 && cell.value <= 9) {
					counts[cell.value]--;
				}
			}
		}
		return counts;
	}, [state.board]);

	const cellsRemaining = useMemo(() => {
		let count = 0;
		for (const row of state.board) {
			for (const cell of row) {
				if (cell.value === null) count++;
			}
		}
		return count;
	}, [state.board]);

	return {
		board: state.board,
		status: state.status,
		selectedCell: state.selectedCell,
		activeNumber: state.activeNumber,
		notesMode: state.notesMode,
		conflicts: state.conflicts,
		remainingCounts,
		cellsRemaining,
		selectCell,
		placeNumber,
		erase,
		undo,
		toggleNotesMode,
		setActiveNumber,
	};
}
