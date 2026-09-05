import {
  decodeSharePayload as decodePayload,
  encodeSharePayload as encodePayload,
} from "./share-codec.ts";
import { solvePuzzle } from "./sudoku.ts";
import type { AssistLevel, Difficulty } from "./types.ts";

const MAX_CHALLENGE_LENGTH = 1_200;

/** A casual time challenge. The puzzle travels with it so future generator changes cannot change the board. */
export type FriendChallenge = {
  version: 1;
  puzzle: string;
  difficulty: Difficulty;
  assistLevel: AssistLevel;
  timeSeconds: number;
  hintsUsed: number;
  /** Player role that solved this puzzle and set the target. */
  setter?: "challenger" | "friend" | undefined;
  /** Stable display names carried by a follow-up challenge. */
  challengerName?: string | undefined;
  friendName?: string | undefined;
  /** Optional score carried by a best-of-three follow-up challenge. */
  series?: FriendChallengeSeries | undefined;
};

export type FriendChallengeSeries = {
  id: string;
  gameNumber: 1 | 2 | 3;
  challengerWins: 0 | 1 | 2;
  friendWins: 0 | 1 | 2;
};

export function challengePath(challenge: FriendChallenge): string {
  return `/challenge/${encodePayload(challenge)}`;
}

export function parseChallenge(encoded: string): FriendChallenge | null {
  try {
    if (
      encoded.length === 0 ||
      encoded.length > MAX_CHALLENGE_LENGTH ||
      !/^[A-Za-z0-9_-]+$/.test(encoded)
    ) {
      return null;
    }
    const decoded = decodePayload(encoded);
    if (!isRecord(decoded)) return null;
    const data = parseBaseChallenge(decoded);
    if (!data) return null;
    const series = parseSeries(decoded.series);
    const setter = parseSetter(decoded.setter);
    const challengerName = parsePlayerName(decoded.challengerName);
    const friendName = parsePlayerName(decoded.friendName);
    if (
      (decoded.series !== undefined && !series) ||
      (decoded.setter !== undefined && !setter) ||
      (decoded.challengerName !== undefined && !challengerName) ||
      (decoded.friendName !== undefined && !friendName) ||
      (setter !== null && (!challengerName || !friendName))
    )
      return null;
    return {
      ...data,
      ...(setter ? { setter } : {}),
      ...(challengerName ? { challengerName } : {}),
      ...(friendName ? { friendName } : {}),
      ...(series ? { series } : {}),
    };
  } catch {
    return null;
  }
}

type BaseChallenge = Omit<
  FriendChallenge,
  "setter" | "challengerName" | "friendName" | "series"
>;

function parseBaseChallenge(
  value: Record<string, unknown>,
): BaseChallenge | null {
  const puzzle = value.puzzle;
  const difficulty = value.difficulty;
  const assistLevel = value.assistLevel;
  const timeSeconds = value.timeSeconds;
  const hintsUsed = value.hintsUsed;
  if (
    value.version !== 1 ||
    typeof puzzle !== "string" ||
    !/^[1-9.]{81}$/.test(puzzle) ||
    !puzzle.includes(".") ||
    !isDifficulty(difficulty) ||
    !isAssistLevel(assistLevel) ||
    !isSafeInteger(timeSeconds) ||
    timeSeconds < 0 ||
    timeSeconds > 604800 ||
    !isSafeInteger(hintsUsed) ||
    hintsUsed < 0 ||
    hintsUsed > 10000 ||
    !solvePuzzle(puzzle)
  ) {
    return null;
  }
  return {
    version: 1,
    puzzle,
    difficulty,
    assistLevel,
    timeSeconds,
    hintsUsed,
  };
}

function parseSetter(value: unknown): "challenger" | "friend" | null {
  return value === undefined
    ? null
    : value === "challenger" || value === "friend"
      ? value
      : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDifficulty(value: unknown): value is Difficulty {
  return (
    value === "easy" ||
    value === "medium" ||
    value === "hard" ||
    value === "expert"
  );
}

function isAssistLevel(value: unknown): value is AssistLevel {
  return value === "paper" || value === "standard" || value === "full";
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function parsePlayerName(value: unknown): string | null {
  if (value === undefined) return null;
  return typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= 64
    ? value
    : null;
}

function parseSeries(value: unknown): FriendChallengeSeries | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const candidate = value as {
    id?: unknown;
    gameNumber?: unknown;
    challengerWins?: unknown;
    friendWins?: unknown;
  };
  if (
    typeof candidate.id !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._~-]{0,95}$/.test(candidate.id) ||
    typeof candidate.gameNumber !== "number" ||
    !Number.isInteger(candidate.gameNumber) ||
    candidate.gameNumber < 1 ||
    candidate.gameNumber > 3 ||
    typeof candidate.challengerWins !== "number" ||
    !Number.isInteger(candidate.challengerWins) ||
    candidate.challengerWins < 0 ||
    candidate.challengerWins > 2 ||
    typeof candidate.friendWins !== "number" ||
    !Number.isInteger(candidate.friendWins) ||
    candidate.friendWins < 0 ||
    candidate.friendWins > 2 ||
    candidate.challengerWins + candidate.friendWins > candidate.gameNumber
  ) {
    return null;
  }
  return {
    id: candidate.id,
    gameNumber: candidate.gameNumber as 1 | 2 | 3,
    challengerWins: candidate.challengerWins as 0 | 1 | 2,
    friendWins: candidate.friendWins as 0 | 1 | 2,
  };
}

export function compareChallenge(
  challenge: FriendChallenge,
  result: Pick<FriendChallenge, "timeSeconds" | "assistLevel" | "hintsUsed">,
): {
  outcome: "beat" | "matched" | "finished" | "extra-help";
  seconds: number;
} {
  const rank = { paper: 0, standard: 1, full: 2 };
  const seconds = Math.abs(challenge.timeSeconds - result.timeSeconds);
  if (
    rank[result.assistLevel] > rank[challenge.assistLevel] ||
    result.hintsUsed > challenge.hintsUsed
  ) {
    return { outcome: "extra-help", seconds };
  }
  return {
    outcome:
      result.timeSeconds < challenge.timeSeconds
        ? "beat"
        : result.timeSeconds === challenge.timeSeconds
          ? "matched"
          : "finished",
    seconds,
  };
}

export function challengeGameKey(challenge: FriendChallenge): string {
  return `challenge-${challengePath(challenge).slice("/challenge/".length)}`;
}
