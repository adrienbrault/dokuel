import { useEffect, useMemo, useRef, useState } from "react";
import { useKeyboard } from "../hooks/useKeyboard.ts";
import { useNumPadPosition } from "../hooks/useNumPadPosition.ts";
import { useSudoku } from "../hooks/useSudoku.ts";
import { formatTime } from "../lib/format.ts";
import { saveGameResult } from "../lib/stats.ts";
import { generatePuzzle, solvePuzzle } from "../lib/sudoku.ts";
import type { Difficulty } from "../lib/types.ts";
import { Board } from "./Board.tsx";
import { GameControls } from "./GameControls.tsx";
import { GameResult } from "./GameResult.tsx";
import { NumPad } from "./NumPad.tsx";
import { NumPadPositionToggle } from "./NumPadPositionToggle.tsx";
import { Timer } from "./Timer.tsx";

const EMPTY_CONFLICTS = new Set<number>();

type SoloGameProps = {
  difficulty: Difficulty;
  showConflicts?: boolean;
  initialPuzzle?: string;
  initialSolution?: string;
  title?: string;
  onBack: () => void;
  onRematch?: () => void;
};

export function SoloGame({
  difficulty,
  showConflicts = true,
  initialPuzzle,
  initialSolution,
  title,
  onBack,
  onRematch,
}: SoloGameProps) {
  const { puzzle, solution } = useMemo(() => {
    if (initialPuzzle && initialSolution) {
      return { puzzle: initialPuzzle, solution: initialSolution };
    }
    const p = generatePuzzle(difficulty);
    const s = solvePuzzle(p);
    return { puzzle: p, solution: s };
  }, [difficulty, initialPuzzle, initialSolution]);

  const game = useSudoku(puzzle, solution);
  const { position, setPosition } = useNumPadPosition();
  const timerSecondsRef = useRef(0);
  const [showResult, setShowResult] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setRevealed(true), 600);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (game.status !== "completed") return;
    saveGameResult(difficulty, timerSecondsRef.current, true);
    const id = setTimeout(() => setShowResult(true), 300);
    return () => clearTimeout(id);
  }, [game.status, difficulty]);

  const handleNumber = (n: number) => {
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
      remainingCounts={game.remainingCounts}
      onNumber={handleNumber}
    />
  );

  return (
    <div className="flex flex-col items-center min-h-dvh bg-white dark:bg-gray-950 py-4 px-4 animate-screen-enter">
      {/* Title (e.g. Daily Challenge) */}
      {title && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{title}</p>
      )}
      {/* Header */}
      <div className="flex items-center justify-between w-full max-w-lg mb-4">
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
					flex gap-3 w-full justify-center flex-1
					${position === "left" ? "flex-row items-center max-w-lg mx-auto" : ""}
					${position === "right" ? "flex-row-reverse items-center max-w-lg mx-auto" : ""}
					${position === "bottom" ? "flex-col items-center" : ""}
				`}
      >
        {position !== "bottom" && numPad}
        <div
          className={`flex flex-col items-center gap-3 ${position === "bottom" ? "flex-1 justify-center w-full" : "flex-1 min-w-0"} ${game.status === "completed" ? "animate-celebration" : ""}`}
        >
          <Board
            board={game.board}
            selectedCell={game.selectedCell}
            conflicts={showConflicts ? game.conflicts : EMPTY_CONFLICTS}
            onSelectCell={game.selectCell}
            animateReveal={!revealed}
          />
          {/* Controls below board */}
          <div className="flex flex-col items-center gap-3 w-full">
            <GameControls
              notesMode={game.notesMode}
              onToggleNotes={game.toggleNotesMode}
              onErase={game.erase}
              onUndo={game.undo}
            />
            {position === "bottom" && numPad}
          </div>
        </div>
      </div>

      {/* Result modal */}
      {showResult && (
        <GameResult
          isWinner={true}
          time={formatTime(timerSecondsRef.current)}
          onNewGame={onBack}
          onRematch={onRematch}
        />
      )}
    </div>
  );
}
