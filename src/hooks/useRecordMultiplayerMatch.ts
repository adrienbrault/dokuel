import { useEffect, useRef } from "react";
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
    const key = `${roomId}:${gameNumber}`;
    if (savedRef.current === key) return;
    savedRef.current = key;
    saveMultiplayerGameResult({
      difficulty,
      assistLevel,
      time: getTimeSeconds(),
      date: new Date().toISOString().slice(0, 10),
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
