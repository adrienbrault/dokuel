import { useEffect, useRef, useState } from "react";
import { useNumPadPosition } from "../hooks/useNumPadPosition.ts";
import { useSudoku } from "../hooks/useSudoku.ts";
import { formatTime } from "../lib/format.ts";
import { Board } from "./Board.tsx";
import { GameControls } from "./GameControls.tsx";
import { GameLayout } from "./GameLayout.tsx";
import { GameResult } from "./GameResult.tsx";
import { NumPad } from "./NumPad.tsx";
import { Timer } from "./Timer.tsx";

const EMPTY_CONFLICTS = new Set<number>();

export type MultiplayerBoardProps = {
  puzzle: string;
  playerId: string;
  showConflicts?: boolean;
  opponentProgress: {
    cellsRemaining: number;
    completionPercent: number;
  } | null;
  opponentDisconnected: boolean;
  gameOver: { winnerId: string; winnerName: string } | null;
  onProgress: (cellsRemaining: number, completionPercent: number) => void;
  onComplete: (board: string) => void;
  onRematch: () => void;
  onBack: () => void;
};

export function MultiplayerBoard({
  puzzle,
  playerId,
  showConflicts = true,
  opponentProgress,
  opponentDisconnected,
  gameOver,
  onProgress,
  onComplete,
  onRematch,
  onBack,
}: MultiplayerBoardProps) {
  const game = useSudoku(puzzle);
  const { position, setPosition } = useNumPadPosition();
  const timerSecondsRef = useRef(0);
  const [showResult, setShowResult] = useState(false);
  const prevCellsRef = useRef(game.cellsRemaining);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setRevealed(true), 600);
    return () => clearTimeout(id);
  }, []);

  // Send progress when cells change
  useEffect(() => {
    if (prevCellsRef.current !== game.cellsRemaining) {
      prevCellsRef.current = game.cellsRemaining;
      const total = 81 - puzzle.split("").filter((c) => c !== ".").length;
      const filled = total - game.cellsRemaining;
      const percent = total > 0 ? Math.round((filled / total) * 100) : 0;
      onProgress(game.cellsRemaining, percent);
    }
  }, [game.cellsRemaining, onProgress, puzzle]);

  // Check completion
  useEffect(() => {
    if (game.status !== "completed") return;
    onComplete(puzzle);
  }, [game.status, onComplete, puzzle]);

  // Show result on game over
  useEffect(() => {
    if (!gameOver) return;
    const id = setTimeout(() => setShowResult(true), 300);
    return () => clearTimeout(id);
  }, [gameOver]);

  const handleNumber = (n: number) => {
    if (game.selectedCell) {
      game.placeNumber(n);
    }
  };

  return (
    <GameLayout
      onBack={onBack}
      position={position}
      onPositionChange={setPosition}
      headerClassName="max-w-[min(100vw-2rem,28rem)]"
      timer={
        <Timer
          running={!gameOver}
          onTick={(s) => {
            timerSecondsRef.current = s;
          }}
        />
      }
      numPad={
        <NumPad
          position={position}
          remainingCounts={game.remainingCounts}
          onNumber={handleNumber}
        />
      }
      board={
        <Board
          board={game.board}
          selectedCell={game.selectedCell}
          conflicts={showConflicts ? game.conflicts : EMPTY_CONFLICTS}
          onSelectCell={game.selectCell}
          animateReveal={!revealed}
        />
      }
      controls={
        <GameControls
          notesMode={game.notesMode}
          onToggleNotes={game.toggleNotesMode}
          onErase={game.erase}
          onUndo={game.undo}
        />
      }
      headerExtra={
        opponentProgress ? (
          <div className="w-full max-w-[min(100vw-2rem,28rem)] mb-3">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>
                Opponent
                {opponentDisconnected && (
                  <span className="ml-1 text-yellow-500">
                    (reconnecting...)
                  </span>
                )}
              </span>
              <span>{opponentProgress.completionPercent}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-red-400 transition-all duration-300"
                style={{ width: `${opponentProgress.completionPercent}%` }}
              />
            </div>
          </div>
        ) : undefined
      }
      footer={
        showResult && gameOver ? (
          <GameResult
            isWinner={gameOver.winnerId === playerId}
            time={formatTime(timerSecondsRef.current)}
            onNewGame={onBack}
            onRematch={onRematch}
          />
        ) : undefined
      }
    />
  );
}
