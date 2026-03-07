import { cellKey } from "../lib/sudoku.ts";
import type { Board as BoardType, Position } from "../lib/types.ts";
import { Cell } from "./Cell.tsx";

type BoardProps = {
	board: BoardType;
	selectedCell: Position | null;
	conflicts: Set<number>;
	onSelectCell: (row: number, col: number) => void;
	animateReveal?: boolean;
};

export function Board({
	board,
	selectedCell,
	conflicts,
	onSelectCell,
	animateReveal,
}: BoardProps) {
	const selectedValue =
		selectedCell !== null
			? board[selectedCell.row][selectedCell.col].value
			: null;

	return (
		<div
			className="grid grid-cols-9 border-2 border-board-border rounded-md overflow-hidden w-full max-w-[min(100vw-2rem,28rem)] aspect-square shadow-lg shadow-black/8 dark:shadow-black/25"
			role="region"
			aria-label="Sudoku board"
		>
			{board.flatMap((row, rowIdx) =>
				row.map((cell, colIdx) => {
					const isSelected =
						selectedCell?.row === rowIdx && selectedCell?.col === colIdx;
					const isHighlighted =
						selectedCell !== null &&
						(selectedCell.row === rowIdx ||
							selectedCell.col === colIdx ||
							(Math.floor(selectedCell.row / 3) === Math.floor(rowIdx / 3) &&
								Math.floor(selectedCell.col / 3) === Math.floor(colIdx / 3)));
					const isSameNumber =
						!isSelected &&
						selectedValue !== null &&
						cell.value !== null &&
						cell.value === selectedValue;
					const isConflict = conflicts.has(cellKey(rowIdx, colIdx));

					return (
						<Cell
							key={cellKey(rowIdx, colIdx)}
							cell={cell}
							row={rowIdx}
							col={colIdx}
							isSelected={isSelected}
							isHighlighted={isHighlighted && !isSelected}
							isSameNumber={isSameNumber}
							isConflict={isConflict}
							onSelect={onSelectCell}
							revealDelay={
								animateReveal && cell.isGiven
									? (rowIdx * 9 + colIdx) * 6
									: undefined
							}
						/>
					);
				}),
			)}
		</div>
	);
}
