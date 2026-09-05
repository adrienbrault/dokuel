import type {
  FriendReceiptResult,
  FriendReceiptSeries,
} from "./friend-receipt.ts";
import type { AssistLevel } from "./types.ts";

const ID_STRING = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,95}$/;

export function parseReceiptResult(value: unknown): FriendReceiptResult | null {
  if (!isReceiptRecord(value)) return null;
  if (
    typeof value.name !== "string" ||
    value.name.trim().length === 0 ||
    value.name.length > 64 ||
    !isValidTime(value.timeSeconds) ||
    !isAssistLevel(value.assistLevel) ||
    !isValidHints(value.hintsUsed)
  ) {
    return null;
  }
  return {
    name: value.name,
    timeSeconds: value.timeSeconds,
    assistLevel: value.assistLevel,
    hintsUsed: value.hintsUsed,
  };
}

export function parseReceiptSeries(value: unknown): FriendReceiptSeries | null {
  if (!isReceiptRecord(value)) return null;
  const gameNumber = value.gameNumber;
  const challengerWins = value.challengerWins;
  const friendWins = value.friendWins;
  if (
    typeof value.id !== "string" ||
    !ID_STRING.test(value.id) ||
    typeof gameNumber !== "number" ||
    !Number.isInteger(gameNumber) ||
    gameNumber < 1 ||
    gameNumber > 3 ||
    typeof challengerWins !== "number" ||
    !Number.isInteger(challengerWins) ||
    challengerWins < 0 ||
    challengerWins > 2 ||
    typeof friendWins !== "number" ||
    !Number.isInteger(friendWins) ||
    friendWins < 0 ||
    friendWins > 2 ||
    challengerWins + friendWins > gameNumber
  ) {
    return null;
  }
  return {
    id: value.id,
    gameNumber: gameNumber as 1 | 2 | 3,
    challengerWins: challengerWins as 0 | 1 | 2,
    friendWins: friendWins as 0 | 1 | 2,
  };
}

function isValidTime(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 604_800
  );
}

function isValidHints(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= 10_000
  );
}

function isAssistLevel(value: unknown): value is AssistLevel {
  return value === "paper" || value === "standard" || value === "full";
}

export function isReceiptRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
