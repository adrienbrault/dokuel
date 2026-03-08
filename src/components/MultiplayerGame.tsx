import { useEffect, useMemo, useRef, useState } from "react";
import { useNumPadPosition } from "../hooks/useNumPadPosition.ts";
import { useSudoku } from "../hooks/useSudoku.ts";
import { useYjsMultiplayer } from "../hooks/useYjsMultiplayer.ts";
import { formatTime } from "../lib/format.ts";
import { solvePuzzle } from "../lib/sudoku.ts";
import { Board } from "./Board.tsx";
import { GameControls } from "./GameControls.tsx";
import { GameResult } from "./GameResult.tsx";
import { Lobby } from "./Lobby.tsx";
import { NumPad } from "./NumPad.tsx";
import { NumPadPositionToggle } from "./NumPadPositionToggle.tsx";
import { Timer } from "./Timer.tsx";

type MultiplayerGameProps = {
  playerId: string;
  playerName: string;
  roomId: string;
  difficulty: import("../lib/types.ts").Difficulty;
  onBack: () => void;
};

export function MultiplayerGame({
  playerId,
  playerName,
  roomId,
  difficulty,
  onBack,
}: MultiplayerGameProps) {
  const mp = useYjsMultiplayer({ roomId, playerId, playerName, difficulty });
  const [toast, setToast] = useState<string | null>(null);

  // Show errors as transient toasts instead of replacing the UI
  useEffect(() => {
    if (!mp.error) return;
    setToast(mp.error);
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [mp.error]);

  if (!mp.roomState) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-white dark:bg-gray-950 animate-screen-enter">
        <p className="text-gray-500 dark:text-gray-400">Connecting...</p>
      </div>
    );
  }

  if (!mp.puzzle && mp.roomState.status === "lobby") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-white dark:bg-gray-950 animate-screen-enter">
        <Lobby
          roomState={mp.roomState}
          playerId={playerId}
          onStart={mp.sendStartGame}
          onBack={onBack}
        />
        {toast && <Toast message={toast} />}
      </div>
    );
  }

  if (mp.puzzle) {
    return (
      <>
        <MultiplayerBoard
          puzzle={mp.puzzle}
          playerId={playerId}
          opponentProgress={mp.opponentProgress}
          opponentDisconnected={mp.opponentDisconnected}
          gameOver={mp.gameOver}
          onProgress={mp.sendProgress}
          onComplete={mp.sendComplete}
          onRematch={mp.sendRematch}
          onBack={onBack}
        />
        {!mp.connected && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-modal-backdrop">
            <div className="bg-white dark:bg-gray-900 rounded-2xl px-8 py-6 shadow-2xl text-center animate-modal-content">
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Reconnecting...
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Please wait
              </p>
            </div>
          </div>
        )}
        {toast && <Toast message={toast} />}
      </>
    );
  }

  return null;
}

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium shadow-lg animate-modal-content">
      {message}
    </div>
  );
}

type MultiplayerBoardProps = {
  puzzle: string;
  playerId: string;
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

function MultiplayerBoard({
  puzzle,
  playerId,
  opponentProgress,
  opponentDisconnected,
  gameOver,
  onProgress,
  onComplete,
  onRematch,
  onBack,
}: MultiplayerBoardProps) {
  const solution = useMemo(() => solvePuzzle(puzzle), [puzzle]);
  const game = useSudoku(puzzle, solution);
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
    onComplete(solution);
  }, [game.status, onComplete, solution]);

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

  const numPad = (
    <NumPad
      position={position}
      remainingCounts={game.remainingCounts}
      onNumber={handleNumber}
    />
  );

  return (
    <div className="flex flex-col items-center min-h-dvh bg-white dark:bg-gray-950 py-4 px-4 animate-screen-enter">
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
          running={!gameOver}
          onTick={(s) => {
            timerSecondsRef.current = s;
          }}
        />
        <NumPadPositionToggle position={position} onChange={setPosition} />
      </div>

      {/* Opponent progress bar */}
      {opponentProgress && (
        <div className="w-full max-w-[min(100vw-2rem,28rem)] mb-3">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>
              Opponent
              {opponentDisconnected && (
                <span className="ml-1 text-yellow-500">(reconnecting...)</span>
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
      )}

      {/* Board */}
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
          animateReveal={!revealed}
        />
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center gap-3 mt-4 w-full">
        <GameControls
          notesMode={game.notesMode}
          onToggleNotes={game.toggleNotesMode}
          onErase={game.erase}
          onUndo={game.undo}
        />
        {position === "bottom" && numPad}
      </div>

      {/* Result */}
      {showResult && gameOver && (
        <GameResult
          isWinner={gameOver.winnerId === playerId}
          time={formatTime(timerSecondsRef.current)}
          onNewGame={onBack}
          onRematch={onRematch}
        />
      )}
    </div>
  );
}
