import { useEffect, useMemo, useRef, useState } from "react";
import { useKeyboard } from "../hooks/useKeyboard.ts";
import { useNumPadPosition } from "../hooks/useNumPadPosition.ts";
import { useSudoku } from "../hooks/useSudoku.ts";
import { formatTime } from "../lib/format.ts";
import {
  deleteGame,
  loadGame,
  type SavedGame,
  saveGame,
} from "../lib/game-storage.ts";
import { getStatsForDifficulty, saveGameResult } from "../lib/stats.ts";
import { generatePuzzle, solvePuzzle } from "../lib/sudoku.ts";
import type { Difficulty } from "../lib/types.ts";
import { Board } from "./Board.tsx";
import { GameControls } from "./GameControls.tsx";
import { GameLayout } from "./GameLayout.tsx";
import { GameResult } from "./GameResult.tsx";
import { NumPad } from "./NumPad.tsx";
import { Timer } from "./Timer.tsx";

const EMPTY_CONFLICTS = new Set<number>();

function boardToValues(board: { value: number | null }[][]): string {
  return board
    .flatMap((row) =>
      row.map((c) => (c.value === null ? "." : String(c.value))),
    )
    .join("");
}

function boardToNotes(board: { notes: Set<number> }[][]): number[][] {
  return board.flatMap((row) => row.map((c) => Array.from(c.notes)));
}

type SoloGameProps = {
  difficulty: Difficulty;
  gameKey?: string | undefined;
  showConflicts?: boolean | undefined;
  initialPuzzle?: string | undefined;
  title?: string | undefined;
  onBack: () => void;
  onRematch?: (() => void) | undefined;
  onComplete?: ((time: number) => void) | undefined;
  streakInfo?: { currentStreak: number; longestStreak: number } | undefined;
};

export function SoloGame({
  difficulty,
  gameKey,
  showConflicts: initialShowConflicts = true,
  initialPuzzle,
  title,
  onBack,
  onRematch,
  onComplete,
  streakInfo,
}: SoloGameProps) {
  const saved = useMemo(() => (gameKey ? loadGame(gameKey) : null), [gameKey]);

  const puzzle = useMemo(() => {
    if (saved?.puzzle) return saved.puzzle;
    if (initialPuzzle) return initialPuzzle;
    return generatePuzzle(difficulty);
  }, [difficulty, initialPuzzle, saved]);

  const solution = useMemo(() => solvePuzzle(puzzle), [puzzle]);

  const savedBoard = useMemo(
    () => (saved ? { values: saved.values, notes: saved.notes } : undefined),
    [saved],
  );

  const game = useSudoku(puzzle, solution, savedBoard);
  const { position, setPosition } = useNumPadPosition();
  const timerSecondsRef = useRef(saved?.timer ?? 0);
  const [showResult, setShowResult] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [showConflicts, setShowConflicts] = useState(initialShowConflicts);
  const [paused, setPaused] = useState(false);
  const [tipDismissed, setTipDismissed] = useState(
    () => localStorage.getItem("sudoku_numpad_tip_dismissed") === "1",
  );

  // Capture PB before this game's result is saved
  const priorStats = useMemo(
    () => getStatsForDifficulty(difficulty),
    [difficulty],
  );
  const personalBest = priorStats?.bestTime ?? null;

  // Auto-save on every board change
  useEffect(() => {
    if (!gameKey || game.status === "completed") return;
    const data: SavedGame = {
      puzzle,
      values: boardToValues(game.board),
      notes: boardToNotes(game.board),
      timer: timerSecondsRef.current,
      difficulty,
      showConflicts,
    };
    saveGame(gameKey, data);
  }, [game.board, gameKey, puzzle, difficulty, showConflicts, game.status]);

  useEffect(() => {
    const id = setTimeout(() => setRevealed(true), 600);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (game.status !== "completed") return;
    if (gameKey) deleteGame(gameKey);
    saveGameResult(difficulty, timerSecondsRef.current, true, game.hintsUsed);
    onComplete?.(timerSecondsRef.current);
    const id = setTimeout(() => setShowResult(true), 300);
    return () => clearTimeout(id);
  }, [game.status, difficulty, gameKey, onComplete, game.hintsUsed]);

  const handleNumber = (n: number) => {
    if (game.selectedCell) {
      game.placeNumber(n);
    }
  };

  const handleBack = () => {
    if (
      game.status === "playing" &&
      game.historyLength > 0 &&
      !window.confirm("Leave game? Your progress is saved.")
    ) {
      return;
    }
    onBack();
  };

  // Auto-pause when tab loses visibility
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && game.status === "playing") {
        setPaused(true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [game.status]);

  useKeyboard({
    selectedCell: game.selectedCell,
    onSelectCell: game.selectCell,
    onDeselectCell: game.deselectCell,
    onPlaceNumber: handleNumber,
    onErase: game.erase,
    onUndo: game.undo,
    onToggleNotes: game.toggleNotesMode,
    enabled: game.status === "playing" && !paused,
  });

  return (
    <GameLayout
      onBack={handleBack}
      title={title}
      position={position}
      onPositionChange={setPosition}
      onDeselectCell={game.deselectCell}
      boardClassName={game.status === "completed" ? "animate-celebration" : ""}
      timer={
        <button
          type="button"
          className="flex flex-col items-center touch-manipulation"
          onClick={() => {
            if (game.status === "playing") setPaused((p) => !p);
          }}
          aria-label={paused ? "Resume" : "Pause"}
        >
          <Timer
            running={game.status === "playing" && !paused && revealed}
            initialSeconds={saved?.timer}
            onTick={(s) => {
              timerSecondsRef.current = s;
            }}
          />
          <span className="text-xs text-text-muted font-mono tabular-nums">
            {paused ? (
              "Paused"
            ) : (
              <>
                <span className="text-accent font-medium">
                  {81 - game.cellsRemaining}
                </span>
                /81
                {personalBest !== null && ` · PB ${formatTime(personalBest)}`}
              </>
            )}
          </span>
        </button>
      }
      numPad={
        <NumPad
          position={position}
          remainingCounts={game.remainingCounts}
          onNumber={handleNumber}
        />
      }
      board={
        <div className="relative w-full">
          <Board
            board={game.board}
            selectedCell={paused ? null : game.selectedCell}
            conflicts={showConflicts ? game.errors : EMPTY_CONFLICTS}
            onSelectCell={paused ? () => {} : game.selectCell}
            animateReveal={!revealed}
          />
          {paused && (
            <button
              type="button"
              className="absolute inset-0 flex items-center justify-center bg-bg-primary/80 backdrop-blur-md rounded-lg"
              onClick={() => setPaused(false)}
              aria-label="Resume game"
            >
              <span className="text-xl font-semibold text-text-muted">
                Paused — tap to resume
              </span>
            </button>
          )}
        </div>
      }
      controls={
        <GameControls
          notesMode={game.notesMode}
          onToggleNotes={game.toggleNotesMode}
          onErase={game.erase}
          onUndo={game.undo}
          showConflicts={showConflicts}
          onToggleConflicts={() => setShowConflicts((v) => !v)}
          historyLength={game.historyLength}
          onHint={game.hint}
        />
      }
      footer={
        showResult ? (
          <GameResult
            isWinner={true}
            time={formatTime(timerSecondsRef.current)}
            timeSeconds={timerSecondsRef.current}
            difficulty={difficulty}
            onNewGame={onBack}
            onRematch={onRematch}
            stats={
              priorStats ?? {
                gamesPlayed: 0,
                bestTime: timerSecondsRef.current,
                averageTime: timerSecondsRef.current,
              }
            }
            isNewPB={
              game.hintsUsed === 0 &&
              (personalBest === null || timerSecondsRef.current < personalBest)
            }
            streakInfo={streakInfo}
            tip={
              !tipDismissed && position === "bottom"
                ? "Tip: Move the numpad to the side for faster two-finger play! Open settings (gear icon) to try it."
                : undefined
            }
            onDismissTip={() => {
              setTipDismissed(true);
              localStorage.setItem("sudoku_numpad_tip_dismissed", "1");
            }}
          />
        ) : undefined
      }
    />
  );
}
