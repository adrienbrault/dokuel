import { useEffect, useMemo, useRef, useState } from "react";
import { useKeyboard } from "../hooks/useKeyboard.ts";
import { useNumPadPosition } from "../hooks/useNumPadPosition.ts";
import { useSudoku } from "../hooks/useSudoku.ts";
import { formatTime } from "../lib/format.ts";
import { generatePuzzle, solvePuzzle } from "../lib/sudoku.ts";
import type { Difficulty } from "../lib/types.ts";
import { Board } from "./Board.tsx";
import { GameControls } from "./GameControls.tsx";
import { GameResult } from "./GameResult.tsx";
import { NumPad } from "./NumPad.tsx";
import { NumPadPositionToggle } from "./NumPadPositionToggle.tsx";
import { Timer } from "./Timer.tsx";

type SoloGameProps = {
	difficulty: Difficulty;
	onBack: () => void;
};

export function SoloGame({ difficulty, onBack }: SoloGameProps) {
	const { puzzle, solution } = useMemo(() => {
		const p = generatePuzzle(difficulty);
		const s = solvePuzzle(p);
		return { puzzle: p, solution: s };
	}, [difficulty]);

	const game = useSudoku(puzzle, solution);
	const { position, setPosition } = useNumPadPosition();
	const timerSecondsRef = useRef(0);
	const [showResult, setShowResult] = useState(false);

	useEffect(() => {
		if (game.status !== "completed") return;
		const id = setTimeout(() => setShowResult(true), 300);
		return () => clearTimeout(id);
	}, [game.status]);

	const handleNumber = (n: number) => {
		game.setActiveNumber(n);
		if (game.selectedCell) {
			game.placeNumber(n);
		}
	};

	useKeyboard({
		selectedCell: game.selectedCell,
		onSelectCell: game.selectCell,
		onPlaceNumber: handleNumber,
		onErase: game.erase,
		onUndo: game.undo,
		onToggleNotes: game.toggleNotesMode,
		enabled: game.status === "playing",
	});

	const numPad = (
		<NumPad
			position={position}
			activeNumber={game.activeNumber}
			remainingCounts={game.remainingCounts}
			onNumber={handleNumber}
		/>
	);

	return (
		<div className="flex flex-col items-center min-h-dvh bg-white dark:bg-gray-950 py-4 px-4">
			{/* Header */}
			<div className="flex items-center justify-between w-full max-w-[min(100vw-2rem,28rem)] mb-4">
				<button
					type="button"
					className="text-sm text-gray-400 dark:text-gray-500 touch-manipulation"
					onClick={onBack}
				>
					← Back
				</button>
				<Timer
					running={game.status === "playing"}
					onTick={(s) => {
						timerSecondsRef.current = s;
					}}
				/>
				<NumPadPositionToggle position={position} onChange={setPosition} />
			</div>

			{/* Main game area */}
			<div
				className={`
					flex items-start gap-3 w-full justify-center
					${position === "left" ? "flex-row" : ""}
					${position === "right" ? "flex-row-reverse" : ""}
					${position === "bottom" ? "flex-col items-center" : ""}
				`}
			>
				{position !== "bottom" && numPad}
				<div className={game.status === "completed" ? "animate-celebration" : ""}>
					<Board
						board={game.board}
						selectedCell={game.selectedCell}
						conflicts={game.conflicts}
						onSelectCell={game.selectCell}
					/>
				</div>
			</div>

			{/* Controls + bottom numpad */}
			<div className="flex flex-col items-center gap-3 mt-4 w-full">
				<GameControls
					notesMode={game.notesMode}
					onToggleNotes={game.toggleNotesMode}
					onErase={game.erase}
					onUndo={game.undo}
				/>
				{position === "bottom" && numPad}
			</div>

			{/* Result modal */}
			{showResult && (
				<GameResult
					isWinner={true}
					time={formatTime(timerSecondsRef.current)}
					onNewGame={onBack}
				/>
			)}
		</div>
	);
}
