import { useEffect, useMemo, useRef, useState } from "react";
import { useNumPadPosition } from "../hooks/useNumPadPosition.ts";
import { useOpponentProgressVisible } from "../hooks/useOpponentProgressVisible.ts";
import { useSudoku } from "../hooks/useSudoku.ts";
import { formatTime } from "../lib/format.ts";
import { Board } from "./Board.tsx";
import { GameControls } from "./GameControls.tsx";
import { GameLayout } from "./GameLayout.tsx";
import { GameResult } from "./GameResult.tsx";
import { NumPad } from "./NumPad.tsx";
import { Timer } from "./Timer.tsx";
import { ToggleSwitch } from "./ToggleSwitch.tsx";

const EMPTY_CONFLICTS = new Set<number>();

export type MultiplayerBoardProps = {
  puzzle: string;
  playerId: string;
  difficulty: import("../lib/types.ts").Difficulty;
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
  difficulty,
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
  const { visible: showOpponentProgress, toggle: toggleOpponentProgress } =
    useOpponentProgressVisible();
  const timerSecondsRef = useRef(0);
  const [showResult, setShowResult] = useState(false);
  const prevCellsRef = useRef(game.cellsRemaining);
  const [revealed, setRevealed] = useState(false);

  const myPercent = useMemo(() => {
    const total = 81 - puzzle.split("").filter((c) => c !== ".").length;
    const filled = total - game.cellsRemaining;
    return total > 0 ? Math.round((filled / total) * 100) : 0;
  }, [game.cellsRemaining, puzzle]);

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
      onDeselectCell={game.deselectCell}
      headerClassName="max-w-[min(100vw-2rem,28rem)]"
      timer={
        <div className="flex flex-col items-center">
          <Timer
            running={!gameOver}
            onTick={(s) => {
              timerSecondsRef.current = s;
            }}
          />
          <span className="text-xs text-text-muted font-mono tabular-nums">
            <span className="text-accent font-medium">
              {81 - game.cellsRemaining}
            </span>
            /81
          </span>
        </div>
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
      settingsExtra={
        <ToggleSwitch
          checked={showOpponentProgress}
          onChange={toggleOpponentProgress}
          label="Opponent bar"
        />
      }
      headerExtra={
        showOpponentProgress && opponentProgress ? (
          <div className="w-full max-w-[min(100vw-2rem,28rem)] mb-3 flex flex-col gap-1.5">
            <ProgressBar label="You" percent={myPercent} color="bg-accent" />
            <ProgressBar
              label={
                opponentDisconnected ? "Opponent (reconnecting...)" : "Opponent"
              }
              percent={opponentProgress.completionPercent}
              color="bg-rose-400"
            />
          </div>
        ) : undefined
      }
      footer={
        showResult && gameOver ? (
          <GameResult
            isWinner={gameOver.winnerId === playerId}
            time={formatTime(timerSecondsRef.current)}
            difficulty={difficulty}
            isMultiplayer
            onNewGame={onBack}
            onRematch={onRematch}
          />
        ) : undefined
      }
    />
  );
}

function ProgressBar({
  label,
  percent,
  color,
}: {
  label: string;
  percent: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-secondary w-24 truncate">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-bg-raised overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-300`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs text-text-secondary font-mono tabular-nums w-8 text-right">
        {percent}%
      </span>
    </div>
  );
}
