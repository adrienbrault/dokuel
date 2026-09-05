import type { AssistLevel, Difficulty } from "./types.ts";

export type MultiplayerGameRecord = {
  difficulty: Difficulty;
  assistLevel: AssistLevel;
  time: number;
  date: string;
  timestamp: number;
  won: boolean;
  opponentName: string;
  roomId: string;
  gameNumber: number;
};

/** The durable counters retained when old match rows leave the history view. */
export type MultiplayerLifetimeBucket = {
  gamesPlayed: number;
  wins: number;
  totalTime: number;
  bestWinTime: number | null;
};

export type MultiplayerLifetime = {
  version: 1;
  buckets: Record<Difficulty, MultiplayerLifetimeBucket>;
};

/**
 * Portable match data keeps useful result history while leaving room and
 * game identity in the local store. Those identities are transport state and
 * cannot be restored on another device.
 */
export type MultiplayerStatsBackupRecord = Omit<
  MultiplayerGameRecord,
  "roomId" | "gameNumber"
>;

export type MultiplayerStatsBackup = {
  version: 1;
  recent: MultiplayerStatsBackupRecord[];
  lifetime: MultiplayerLifetime;
};

export type IndexedMatch = Pick<
  MultiplayerGameRecord,
  "difficulty" | "time" | "won"
>;

export type MultiplayerStatsStore = {
  version: 1;
  recent: MultiplayerGameRecord[];
  lifetime: MultiplayerLifetime;
  /** Full local identity index; unlike recent, this is never evicted. */
  matches: Record<string, IndexedMatch>;
  /** Imported backups do not have identities for evicted rows. */
  indexComplete: boolean;
};

export type MultiplayerSummary = {
  played: number;
  wins: number;
  losses: number;
  winRate: number;
};

export type MultiplayerDifficultyStats = {
  played: number;
  wins: number;
  losses: number;
  winRate: number;
  bestWinTime: number | null;
};

export const DIFFICULTIES: readonly Difficulty[] = [
  "easy",
  "medium",
  "hard",
  "expert",
];

export const ASSIST_LEVELS: readonly AssistLevel[] = [
  "paper",
  "standard",
  "full",
];

export const MAX_RECORDS_PER_DIFFICULTY = 100;
export const MAX_RECENT_RECORDS = MAX_RECORDS_PER_DIFFICULTY * 4;

export const RECORD_KEYS = [
  "difficulty",
  "assistLevel",
  "time",
  "date",
  "timestamp",
  "won",
  "opponentName",
  "roomId",
  "gameNumber",
] as const;

export const BACKUP_RECORD_KEYS = [
  "difficulty",
  "assistLevel",
  "time",
  "date",
  "timestamp",
  "won",
  "opponentName",
] as const;
