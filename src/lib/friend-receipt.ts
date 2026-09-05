import {
  type FriendChallenge,
  type FriendChallengeSeries,
  parseChallenge,
} from "./challenge.ts";
import {
  isReceiptRecord,
  parseReceiptResult,
  parseReceiptSeries,
} from "./friend-receipt-validation.ts";
import {
  decodeSharePayload as decodePayload,
  encodeSharePayload as encodePayload,
} from "./share-codec.ts";
import type { AssistLevel, Difficulty } from "./types.ts";

/** A named result returned to the person who sent a friend challenge. */
export type FriendReceiptResult = {
  name: string;
  timeSeconds: number;
  assistLevel: AssistLevel;
  hintsUsed: number;
};

/** Progress after one completed game in a best-of-three series. */
export type FriendReceiptSeries = FriendChallengeSeries;

/** A portable, account-free comparison of one friend challenge. */
export type FriendReceipt = {
  version: 1;
  /** Stable identity for this game; it prevents duplicate history entries. */
  matchId: string;
  challenge: FriendChallenge;
  challenger: FriendReceiptResult;
  friend: FriendReceiptResult;
  series?: FriendReceiptSeries | undefined;
};

export type CreateFriendReceiptInput = {
  matchId: string;
  challenge: FriendChallenge;
  friendTimeSeconds: number;
  friendAssistLevel: AssistLevel;
  friendHintsUsed: number;
  challengerName?: string | undefined;
  friendName?: string | undefined;
  series?: FriendReceiptSeries | undefined;
};

export type FriendReceiptComparison = {
  outcome: "challenger" | "friend" | "tie" | "practice";
  deltaSeconds: number;
  challengerCompetitive: boolean;
  friendCompetitive: boolean;
};

export type ReceiptSide = "challenger" | "friend";
export type FriendRoundMode = "again" | "bestOfThree";

/** Metadata for a round that still needs to be solved by its setter. */
export type FriendRoundPlan = {
  mode: FriendRoundMode;
  side: ReceiptSide;
  difficulty: Difficulty;
  assistLevel: AssistLevel;
  challengerName: string;
  friendName: string;
  /** Score before the planned game is played. */
  series?: FriendChallengeSeries | undefined;
};

const RECEIPT_PREFIX = "/receipt/";
const MAX_RECEIPT_LENGTH = 2_400;
const ID_STRING = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,95}$/;
const ASSIST_RANK: Record<AssistLevel, number> = {
  paper: 0,
  standard: 1,
  full: 2,
};

/** Build the receipt a challenged player can send back after finishing. */
export function createFriendReceipt(
  input: CreateFriendReceiptInput,
): FriendReceipt {
  const challengerName =
    input.challenge.challengerName ?? input.challengerName ?? "Your friend";
  const friendName = input.challenge.friendName ?? input.friendName ?? "You";
  const setter = input.challenge.setter ?? "challenger";
  const target: FriendReceiptResult = {
    name: setter === "challenger" ? challengerName : friendName,
    timeSeconds: input.challenge.timeSeconds,
    assistLevel: input.challenge.assistLevel,
    hintsUsed: input.challenge.hintsUsed,
  };
  const responder: FriendReceiptResult = {
    name: setter === "challenger" ? friendName : challengerName,
    timeSeconds: input.friendTimeSeconds,
    assistLevel: input.friendAssistLevel,
    hintsUsed: input.friendHintsUsed,
  };
  const receipt: FriendReceipt = {
    version: 1,
    matchId: input.matchId,
    challenge: input.challenge,
    challenger: setter === "challenger" ? target : responder,
    friend: setter === "challenger" ? responder : target,
  };
  const baseSeries = input.series ?? input.challenge.series;
  if (baseSeries) {
    receipt.series = advanceSeries(baseSeries, compareFriendReceipt(receipt));
  }
  return receipt;
}

/**
 * Prepare a fresh round. Puzzle generation is deliberately left to the UI
 * after this plan is displayed, so the setter must solve the new board before
 * a target link can be shared.
 */
export function createFriendRoundPlan(
  receipt: FriendReceipt,
  side: ReceiptSide,
  mode: FriendRoundMode,
): FriendRoundPlan | null {
  const series = mode === "bestOfThree" ? nextSeries(receipt) : undefined;
  if (mode === "bestOfThree" && !series) return null;
  return {
    mode,
    side,
    difficulty: receipt.challenge.difficulty,
    assistLevel: receipt[side].assistLevel,
    challengerName: receipt.challenger.name,
    friendName: receipt.friend.name,
    ...(series ? { series } : {}),
  };
}

/** Build the target link only after the planned setter has solved its board. */
export function createFriendRoundChallenge(
  plan: FriendRoundPlan,
  puzzle: string,
  timeSeconds: number,
  assistLevel: AssistLevel,
  hintsUsed: number,
): FriendChallenge {
  return {
    version: 1,
    puzzle,
    difficulty: plan.difficulty,
    assistLevel,
    timeSeconds: Math.max(0, Math.floor(timeSeconds)),
    hintsUsed,
    setter: plan.side,
    challengerName: plan.challengerName,
    friendName: plan.friendName,
    ...(plan.series ? { series: plan.series } : {}),
  };
}

/** Build a URL-safe receipt link that is independent of accounts or a server. */
export function friendReceiptPath(receipt: FriendReceipt): string {
  return `${RECEIPT_PREFIX}${encodePayload(receipt)}`;
}

/** Parse and validate a receipt received from a friend or messaging app. */
export function parseFriendReceipt(encoded: string): FriendReceipt | null {
  try {
    if (
      encoded.length === 0 ||
      encoded.length > MAX_RECEIPT_LENGTH ||
      !/^[A-Za-z0-9_-]+$/.test(encoded)
    ) {
      return null;
    }
    const value = decodePayload(encoded);
    if (!isReceiptRecord(value) || value.version !== 1) return null;

    const matchId = value.matchId;
    if (typeof matchId !== "string" || !ID_STRING.test(matchId)) return null;

    // Reuse the challenge parser so receipt links inherit the same puzzle,
    // solution, difficulty, assistance, and counter invariants as challenge
    // links. The embedded challenge is ASCII, so this conversion is bounded
    // by the receipt payload limit above.
    const challenge = parseChallenge(encodePayload(value.challenge));
    if (!challenge) return null;

    const challenger = parseReceiptResult(value.challenger);
    const friend = parseReceiptResult(value.friend);
    if (!challenger || !friend) return null;
    if (
      (challenge.challengerName !== undefined &&
        challenger.name !== challenge.challengerName) ||
      (challenge.friendName !== undefined &&
        friend.name !== challenge.friendName)
    ) {
      return null;
    }

    const series = parseReceiptSeries(value.series);
    if (value.series !== undefined && !series) return null;

    return {
      version: 1,
      matchId,
      challenge,
      challenger,
      friend,
      ...(series ? { series } : {}),
    };
  } catch {
    return null;
  }
}

/** Compare both receipt times while preserving the challenge's fairness rule. */
export function compareFriendReceipt(
  receipt: FriendReceipt,
): FriendReceiptComparison {
  const challengerCompetitive = isCompetitive(
    receipt.challenge,
    receipt.challenger,
  );
  const friendCompetitive = isCompetitive(receipt.challenge, receipt.friend);
  const deltaSeconds = Math.abs(
    receipt.challenger.timeSeconds - receipt.friend.timeSeconds,
  );

  if (!challengerCompetitive || !friendCompetitive) {
    return {
      outcome: "practice",
      deltaSeconds,
      challengerCompetitive,
      friendCompetitive,
    };
  }
  return {
    outcome:
      receipt.challenger.timeSeconds < receipt.friend.timeSeconds
        ? "challenger"
        : receipt.challenger.timeSeconds > receipt.friend.timeSeconds
          ? "friend"
          : "tie",
    deltaSeconds,
    challengerCompetitive,
    friendCompetitive,
  };
}

function isCompetitive(
  challenge: FriendChallenge,
  result: FriendReceiptResult,
): boolean {
  return (
    ASSIST_RANK[result.assistLevel] <= ASSIST_RANK[challenge.assistLevel] &&
    result.hintsUsed <= challenge.hintsUsed
  );
}

function nextSeries(receipt: FriendReceipt): FriendChallengeSeries | null {
  const completed = receipt.series ?? completedFirstSeries(receipt);
  if (!completed || completed.gameNumber >= 3) return null;
  if (completed.challengerWins >= 2 || completed.friendWins >= 2) return null;
  return {
    id: completed.id,
    gameNumber: (completed.gameNumber + 1) as 1 | 2 | 3,
    challengerWins: completed.challengerWins,
    friendWins: completed.friendWins,
  };
}

function completedFirstSeries(
  receipt: FriendReceipt,
): FriendReceiptSeries | null {
  const comparison = compareFriendReceipt(receipt);
  if (comparison.outcome === "practice") return null;
  return {
    id: `series-${receipt.matchId}`,
    gameNumber: 1,
    challengerWins: comparison.outcome === "challenger" ? 1 : 0,
    friendWins: comparison.outcome === "friend" ? 1 : 0,
  };
}

function advanceSeries(
  series: FriendChallengeSeries,
  comparison: FriendReceiptComparison,
): FriendReceiptSeries {
  return {
    ...series,
    challengerWins: clampWin(
      series.challengerWins + (comparison.outcome === "challenger" ? 1 : 0),
    ),
    friendWins: clampWin(
      series.friendWins + (comparison.outcome === "friend" ? 1 : 0),
    ),
  };
}

function clampWin(value: number): 0 | 1 | 2 {
  return Math.min(2, Math.max(0, value)) as 0 | 1 | 2;
}
