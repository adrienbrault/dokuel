import { useEffect } from "react";
import {
  boardToNotes,
  boardToValues,
  deleteGame,
  type SavedGame,
  saveGame,
} from "../lib/game-storage.ts";
import { saveGameResult } from "../lib/stats.ts";
import type { AssistLevel, Board, Difficulty } from "../lib/types.ts";

/** Bundles auto-save, reveal animation, and completion side-effects. */
export function useSoloGameEffects({
  board,
  status,
  gameKey,
  puzzle,
  difficulty,
  assistLevel,
  timerRef,
  hintsUsed,
  onComplete,
  setRevealed,
  setShowResult,
}: {
  board: Board;
  status: string;
  gameKey: string | undefined;
  puzzle: string;
  difficulty: Difficulty;
  assistLevel: AssistLevel;
  timerRef: React.RefObject<number>;
  hintsUsed: number;
  onComplete: ((time: number) => void) | undefined;
  setRevealed: (v: boolean) => void;
  setShowResult: (v: boolean) => void;
}) {
  // Auto-save on every board change
  useEffect(() => {
    if (!gameKey || status === "completed") return;
    const data: SavedGame = {
      puzzle,
      values: boardToValues(board),
      notes: boardToNotes(board),
      timer: timerRef.current,
      difficulty,
      assistLevel,
    };
    saveGame(gameKey, data);
  }, [board, gameKey, puzzle, difficulty, assistLevel, status, timerRef]);

  // Reveal animation
  useEffect(() => {
    const id = setTimeout(() => setRevealed(true), 600);
    return () => clearTimeout(id);
  }, [setRevealed]);

  // Completion
  useEffect(() => {
    if (status !== "completed") return;
    if (gameKey) deleteGame(gameKey);
    saveGameResult(difficulty, timerRef.current, true, hintsUsed);
    onComplete?.(timerRef.current);
    const id = setTimeout(() => setShowResult(true), 300);
    return () => clearTimeout(id);
  }, [
    status,
    difficulty,
    gameKey,
    onComplete,
    hintsUsed,
    timerRef,
    setShowResult,
  ]);
}
