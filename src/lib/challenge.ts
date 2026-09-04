import { solvePuzzle } from "./sudoku.ts";
import type { AssistLevel, Difficulty } from "./types.ts";

/** A casual time challenge. The puzzle travels with it so future generator changes cannot change the board. */
export type FriendChallenge = {
  version: 1;
  puzzle: string;
  difficulty: Difficulty;
  assistLevel: AssistLevel;
  timeSeconds: number;
  hintsUsed: number;
};

export function challengePath(challenge: FriendChallenge): string {
  return `/challenge/${btoa(JSON.stringify(challenge)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")}`;
}

export function parseChallenge(encoded: string): FriendChallenge | null {
  try {
    if (encoded.length > 600) return null;
    const data = JSON.parse(
      atob(encoded.replaceAll("-", "+").replaceAll("_", "/")),
    );
    if (
      !data ||
      data.version !== 1 ||
      typeof data.puzzle !== "string" ||
      !/^[1-9.]{81}$/.test(data.puzzle) ||
      !data.puzzle.includes(".") ||
      !["easy", "medium", "hard", "expert"].includes(data.difficulty) ||
      !["paper", "standard", "full"].includes(data.assistLevel) ||
      !Number.isSafeInteger(data.timeSeconds) ||
      data.timeSeconds < 0 ||
      data.timeSeconds > 604800 ||
      !Number.isSafeInteger(data.hintsUsed) ||
      data.hintsUsed < 0 ||
      data.hintsUsed > 10000 ||
      !solvePuzzle(data.puzzle)
    )
      return null;
    return {
      version: 1,
      puzzle: data.puzzle,
      difficulty: data.difficulty,
      assistLevel: data.assistLevel,
      timeSeconds: data.timeSeconds,
      hintsUsed: data.hintsUsed,
    };
  } catch {
    return null;
  }
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
