import type { AssistLevel, Difficulty } from "./types.ts";

export type GameOrigin =
  | "generated"
  | "daily"
  | "friend"
  | "imported"
  | "replay";

export type GameStats = {
  difficulty: Difficulty;
  assistLevel: AssistLevel;
  time: number;
  date: string;
  won: boolean;
  hintsUsed?: number;
  origin?: GameOrigin;
  attemptId?: string;
  puzzleId?: string;
};

export type StatsSummary = {
  gamesPlayed: number;
  bestTime: number | null;
  averageTime: number;
};

export type ResultMetadata = {
  origin?: GameOrigin;
  attemptId?: string;
  puzzleId?: string;
  date?: string;
};

export type ResultInput = {
  difficulty: Difficulty;
  assistLevel: AssistLevel;
  time: number;
  won: boolean;
  hintsUsed?: number;
  metadata?: ResultMetadata;
};

export type LifetimeBucket = {
  gamesPlayed: number;
  totalTime: number;
  bestTime: number | null;
};

export type LifetimeStore = {
  version: 1;
  buckets: Record<string, LifetimeBucket>;
};

export type ResultStore = {
  version: 1;
  recent: GameStats[];
  lifetime: LifetimeStore;
  attempts: Record<string, GameStats>;
};

export type RecordedResult = {
  record: GameStats;
  summary: StatsSummary | null;
  duplicate: boolean;
  persisted: boolean;
};
