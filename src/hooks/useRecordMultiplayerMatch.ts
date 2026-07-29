import { useEffect, useRef } from "react";
import { todayLocalISO } from "../lib/date.ts";
import { saveMultiplayerGameResult } from "../lib/multiplayer-stats.ts";
import type { AssistLevel, Difficulty } from "../lib/types.ts";

type Options = {
  gameOver: { winnerId: string; winnerName: string } | null;
  roomId: string;
  gameNumber: number;
  difficulty: Difficulty;
  assistLevel: AssistLevel;
  playerId: string;
  opponentName: string;
  /** Resolved when the effect fires so the recorded duration reflects
   *  the timer at game-over, not at mount. */
  getTimeSeconds: () => number;
};

/**
 * Writes one MultiplayerGameRecord per finished match. The store dedups
 * on (roomId, gameNumber); the local ref guards re-renders within a
 * single mount so we don't even bother round-tripping localStorage.
 */
export function useRecordMultiplayerMatch({
  gameOver,
  roomId,
  gameNumber,
  difficulty,
  assistLevel,
  playerId,
  opponentName,
  getTimeSeconds,
}: Options) {
  const savedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!gameOver) return;
    // Winner is part of the key: a photo-finish can flip gameOver after
    // the optimistic record, and the corrected outcome must re-save
    // (the store upserts on the same roomId+gameNumber).
    const key = `${roomId}:${gameNumber}:${gameOver.winnerId}`;
    if (savedRef.current === key) return;
    savedRef.current = key;
    saveMultiplayerGameResult({
      difficulty,
      assistLevel,
      time: getTimeSeconds(),
      date: todayLocalISO(),
      timestamp: Date.now(),
      won: gameOver.winnerId === playerId,
      opponentName: opponentName || gameOver.winnerName,
      roomId,
      gameNumber,
    });
  }, [
    gameOver,
    roomId,
    gameNumber,
    difficulty,
    assistLevel,
    playerId,
    opponentName,
    getTimeSeconds,
  ]);
}
