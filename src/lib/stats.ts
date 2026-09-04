import {
  getRecentResultsForOrigin,
  getSummary,
  readRecentResults,
  recordResult,
} from "./result-store.ts";
import type {
  GameOrigin,
  GameStats,
  ResultMetadata,
  StatsSummary,
} from "./result-store-types.ts";
import type { AssistLevel, Difficulty } from "./types.ts";

export type {
  GameOrigin,
  GameStats,
  ResultMetadata,
  StatsSummary,
} from "./result-store-types.ts";

export type SaveGameResultOptions = {
  difficulty: Difficulty;
  assistLevel: AssistLevel;
  time: number;
  won: boolean;
  hintsUsed?: number;
  origin?: GameOrigin;
  attemptId?: string;
  puzzleId?: string;
  date?: string;
};

export type AssistLevelStats = {
  assistLevel: AssistLevel;
  gamesPlayed: number;
  bestTime: number | null;
  averageTime: number;
};

export function getStats(): GameStats[] {
  return readRecentResults();
}

export function saveGameResult(
  options: SaveGameResultOptions,
): StatsSummary | null;
export function saveGameResult(
  difficulty: Difficulty,
  assistLevel: AssistLevel,
  time: number,
  won: boolean,
  hintsUsed?: number,
  metadata?: ResultMetadata,
): StatsSummary | null;
export function saveGameResult(
  first: Difficulty | SaveGameResultOptions,
  assistLevel?: AssistLevel,
  time?: number,
  won?: boolean,
  hintsUsed?: number,
  metadata?: ResultMetadata,
): StatsSummary | null {
  const input =
    typeof first === "string"
      ? {
          difficulty: first,
          assistLevel: assistLevel as AssistLevel,
          time: time as number,
          won: won as boolean,
          ...(hintsUsed === undefined ? {} : { hintsUsed }),
          ...(metadata === undefined ? {} : { metadata }),
        }
      : {
          difficulty: first.difficulty,
          assistLevel: first.assistLevel,
          time: first.time,
          won: first.won,
          ...(first.hintsUsed === undefined
            ? {}
            : { hintsUsed: first.hintsUsed }),
          metadata: metadataFromOptions(first),
        };
  return recordResult(input).summary;
}

export function getStatsForDifficulty(
  difficulty: Difficulty,
  assistLevel?: AssistLevel,
  origin: GameOrigin = "generated",
): StatsSummary | null {
  return getSummary(difficulty, assistLevel, origin);
}

export function getStatsByAssistLevel(
  difficulty: Difficulty,
  origin: GameOrigin = "generated",
): AssistLevelStats[] {
  const levels: readonly AssistLevel[] = ["paper", "standard", "full"];
  return levels.flatMap((level) => {
    const stats = getStatsForDifficulty(difficulty, level, origin);
    return stats ? [{ assistLevel: level, ...stats }] : [];
  });
}

export function getStatsForOrigin(
  origin: GameOrigin,
  difficulty: Difficulty,
  assistLevel?: AssistLevel,
): StatsSummary | null {
  return getStatsForDifficulty(difficulty, assistLevel, origin);
}

export { getRecentResultsForOrigin };

function metadataFromOptions(options: SaveGameResultOptions): ResultMetadata {
  return {
    ...(options.origin === undefined ? {} : { origin: options.origin }),
    ...(options.attemptId === undefined
      ? {}
      : { attemptId: options.attemptId }),
    ...(options.puzzleId === undefined ? {} : { puzzleId: options.puzzleId }),
    ...(options.date === undefined ? {} : { date: options.date }),
  };
}
