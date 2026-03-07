import { memo } from "react";
import { DIGITS } from "../lib/constants.ts";
import type { Cell as CellType } from "../lib/types.ts";

type CellProps = {
	cell: CellType;
	row: number;
	col: number;
	isSelected: boolean;
	isHighlighted: boolean;
	isSameNumber: boolean;
	isConflict: boolean;
	onSelect: (row: number, col: number) => void;
	revealDelay?: number;
};

export const Cell = memo(function Cell({
	cell,
	row,
	col,
	isSelected,
	isHighlighted,
	isSameNumber,
	isConflict,
	onSelect,
	revealDelay,
}: CellProps) {
	const bgClass = isSelected
		? "bg-cell-selected"
		: isConflict
			? "bg-cell-conflict-bg"
			: isSameNumber
				? "bg-cell-same-number"
				: isHighlighted
					? "bg-cell-highlight"
					: "bg-cell-bg";

	const textClass = cell.isGiven
		? "text-cell-given font-bold"
		: isConflict
			? "text-cell-conflict font-semibold"
			: "text-cell-user font-semibold";

	const borderRight =
		col === 2 || col === 5 ? "border-r-2 border-r-board-border" : "";
	const borderBottom =
		row === 2 || row === 5 ? "border-b-2 border-b-board-border" : "";

	return (
		<button
			type="button"
			className={`
				flex items-center justify-center
				aspect-square w-full
				border border-gray-200 dark:border-gray-700
				${bgClass} ${borderRight} ${borderBottom}
				transition-colors duration-100
				select-none touch-manipulation
				outline-none focus-visible:ring-2 focus-visible:ring-accent
				${isSelected ? "cell-selected-glow" : ""}
				${revealDelay !== undefined ? "animate-cell-reveal" : ""}
			`}
			style={
				revealDelay !== undefined
					? { animationDelay: `${revealDelay}ms` }
					: undefined
			}
			onClick={() => onSelect(row, col)}
			aria-label={`Cell row ${row + 1} column ${col + 1}${cell.value ? `, value ${cell.value}` : ", empty"}`}
		>
			{cell.value ? (
				<span
					key={cell.value}
					className={`text-[clamp(0.875rem,4vw,1.5rem)] leading-none ${textClass} ${!cell.isGiven ? "animate-pop-in" : ""}`}
				>
					{cell.value}
				</span>
			) : cell.notes.size > 0 ? (
				<div className="grid grid-cols-3 grid-rows-3 w-full h-full p-[1px]">
					{DIGITS.map((n) => (
						<span
							key={n}
							className="flex items-center justify-center text-[clamp(0.4rem,1.5vw,0.625rem)] text-gray-400 dark:text-gray-500 leading-none"
						>
							{cell.notes.has(n) ? n : ""}
						</span>
					))}
				</div>
			) : null}
		</button>
	);
});
