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
import { saveGameResult } from "../lib/stats.ts";
import { generatePuzzle } from "../lib/sudoku.ts";
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
};

export function SoloGame({
  difficulty,
  gameKey,
  showConflicts = true,
  initialPuzzle,
  title,
  onBack,
  onRematch,
}: SoloGameProps) {
  const saved = useMemo(() => (gameKey ? loadGame(gameKey) : null), [gameKey]);

  const puzzle = useMemo(() => {
    if (saved?.puzzle) return saved.puzzle;
    if (initialPuzzle) return initialPuzzle;
    return generatePuzzle(difficulty);
  }, [difficulty, initialPuzzle, saved]);

  const savedBoard = useMemo(
    () => (saved ? { values: saved.values, notes: saved.notes } : undefined),
    [saved],
  );

  const game = useSudoku(puzzle, savedBoard);
  const { position, setPosition } = useNumPadPosition();
  const timerSecondsRef = useRef(saved?.timer ?? 0);
  const [showResult, setShowResult] = useState(false);
  const [revealed, setRevealed] = useState(false);

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
    saveGameResult(difficulty, timerSecondsRef.current, true);
    const id = setTimeout(() => setShowResult(true), 300);
    return () => clearTimeout(id);
  }, [game.status, difficulty, gameKey]);

  const handleNumber = (n: number) => {
    if (game.selectedCell) {
      game.placeNumber(n);
    }
  };

  useKeyboard({
    selectedCell: game.selectedCell,
    onSelectCell: game.selectCell,
    onDeselectCell: game.deselectCell,
    onPlaceNumber: handleNumber,
    onErase: game.erase,
    onUndo: game.undo,
    onToggleNotes: game.toggleNotesMode,
    enabled: game.status === "playing",
  });

  return (
    <GameLayout
      onBack={onBack}
      title={title}
      position={position}
      onPositionChange={setPosition}
      onDeselectCell={game.deselectCell}
      boardClassName={game.status === "completed" ? "animate-celebration" : ""}
      timer={
        <div className="flex flex-col items-center">
          <Timer
            running={game.status === "playing"}
            initialSeconds={saved?.timer}
            onTick={(s) => {
              timerSecondsRef.current = s;
            }}
          />
          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums">
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
      footer={
        showResult ? (
          <GameResult
            isWinner={true}
            time={formatTime(timerSecondsRef.current)}
            timeSeconds={timerSecondsRef.current}
            difficulty={difficulty}
            onNewGame={onBack}
            onRematch={onRematch}
          />
        ) : undefined
      }
    />
  );
}
