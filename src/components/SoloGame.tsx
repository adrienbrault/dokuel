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

type SoloGameProps = {
  difficulty: Difficulty;
  initialPuzzle?: string;
  initialSolution?: string;
  onBack: () => void;
  onRematch?: () => void;
};

export function SoloGame({
  difficulty,
  initialPuzzle,
  initialSolution,
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

  const controls = (
    <GameControls
      notesMode={game.notesMode}
      onToggleNotes={game.toggleNotesMode}
      onErase={game.erase}
      onUndo={game.undo}
    />
  );

  return (
    <div className="flex flex-col items-center min-h-dvh bg-white dark:bg-gray-950 py-4 px-4 animate-screen-enter">
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
      {position === "bottom" ? (
        <div className="flex flex-col items-center gap-3 flex-1 justify-center w-full">
          <div
            className={`flex flex-col items-center gap-3 w-full max-w-lg ${game.status === "completed" ? "animate-celebration" : ""}`}
          >
            <Board
              board={game.board}
              selectedCell={game.selectedCell}
              conflicts={game.conflicts}
              onSelectCell={game.selectCell}
              animateReveal={!revealed}
            />
            {controls}
            {numPad}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 flex-1 justify-center w-full">
          <div className="flex gap-3 w-full max-w-lg items-center justify-center">
            {position === "left" && numPad}
            <div
              className={`flex-1 min-w-0 ${game.status === "completed" ? "animate-celebration" : ""}`}
            >
              <Board
                board={game.board}
                selectedCell={game.selectedCell}
                conflicts={game.conflicts}
                onSelectCell={game.selectCell}
                animateReveal={!revealed}
              />
            </div>
            {position === "right" && numPad}
          </div>
          <div className="w-full max-w-lg">{controls}</div>
        </div>
      )}

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
