import { startOfLocalDay } from "./date.ts";
import { getMultiplayerStats } from "./multiplayer-stats.ts";
import { getStats } from "./stats.ts";
import type { AssistLevel, Difficulty } from "./types.ts";

type PlayedGame = {
  difficulty: Difficulty;
  assistLevel: AssistLevel;
  /** Seconds on the clock when the game ended. */
  time: number;
  /** Local ISO date (YYYY-MM-DD) the game was played. */
  date: string;
  /** Epoch ms, used for ordering. */
  timestamp: number;
  won: boolean;
};

export type GameHistoryEntry =
  | (PlayedGame & { kind: "solo" })
  | (PlayedGame & { kind: "duel"; opponentName: string });

/**
 * Every finished game the device remembers, newest first, across both
 * stores: solo/daily results live in the stats ring, duels in the
 * multiplayer ring. Each store keeps its own per-bucket cap, so the
 * history is as long as those allow and no longer.
 */
export function getGameHistory(): GameHistoryEntry[] {
  const solo: GameHistoryEntry[] = getStats().map((s) => ({
    kind: "solo",
    difficulty: s.difficulty,
    assistLevel: s.assistLevel,
    time: s.time,
    date: s.date,
    // Results predating the stamp only know their day.
    timestamp: s.timestamp ?? startOfLocalDay(s.date),
    won: s.won,
  }));
  const duels: GameHistoryEntry[] = getMultiplayerStats().map((r) => ({
    kind: "duel",
    difficulty: r.difficulty,
    assistLevel: r.assistLevel,
    time: r.time,
    date: r.date,
    timestamp: r.timestamp,
    won: r.won,
    opponentName: r.opponentName,
  }));
  return [...duels, ...solo].sort((a, b) => b.timestamp - a.timestamp);
}
