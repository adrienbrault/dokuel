import { useMemo, useRef, useState } from "react";
import { useNumPadPosition } from "../hooks/useNumPadPosition.ts";
import { useSudoku } from "../hooks/useSudoku.ts";
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

	const handleNumber = (n: number) => {
		if (game.activeNumber === n) {
			game.setActiveNumber(n); // toggle off
		} else {
			game.setActiveNumber(n);
		}

		if (game.selectedCell) {
			game.placeNumber(n);
		}
	};

	const formatTime = (s: number) => {
		const mins = Math.floor(s / 60);
		const secs = s % 60;
		return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
	};

	// Show result modal when completed
	if (game.status === "completed" && !showResult) {
		// Use setTimeout to avoid setState during render
		setTimeout(() => setShowResult(true), 300);
	}

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
				<Board
					board={game.board}
					selectedCell={game.selectedCell}
					conflicts={game.conflicts}
					onSelectCell={game.selectCell}
				/>
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
