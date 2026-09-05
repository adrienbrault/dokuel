import {
  type FriendReceipt,
  friendReceiptPath,
  parseFriendReceipt,
} from "./friend-receipt.ts";
import { readJson, writeJson } from "./storage.ts";

export type RivalryRecord = {
  version: 1;
  recordedAt: number;
  receipt: FriendReceipt;
};

const HISTORY_KEY = "dokuel_rivalry_history";
const RECEIPT_PREFIX = "/receipt/";
const MAX_RIVALRY_RECORDS = 500;

/** Read validated comparison receipts in newest-first order. */
export function readRivalryHistory(): RivalryRecord[] {
  return readJson<RivalryRecord[]>(HISTORY_KEY, [], (value) => {
    if (!Array.isArray(value)) return null;
    const records: RivalryRecord[] = [];
    const matchIds = new Set<string>();
    for (const entry of value) {
      const record = parseRecord(entry);
      if (!record || matchIds.has(record.receipt.matchId)) continue;
      matchIds.add(record.receipt.matchId);
      records.push(record);
      if (records.length >= MAX_RIVALRY_RECORDS) break;
    }
    return records;
  });
}

/** Persist one receipt; repeated receipt opens are idempotent by matchId. */
export function recordRivalry(
  receipt: FriendReceipt,
  recordedAt = Date.now(),
): boolean {
  if (!Number.isSafeInteger(recordedAt) || recordedAt < 0) return false;
  const canonical = canonicalReceipt(receipt);
  if (!canonical) return false;

  const history = readRivalryHistory();
  if (history.some((record) => record.receipt.matchId === canonical.matchId)) {
    return false;
  }
  const next: RivalryRecord[] = [
    { version: 1 as const, recordedAt, receipt: canonical },
    ...history,
  ].slice(0, MAX_RIVALRY_RECORDS);
  return writeJson(HISTORY_KEY, next);
}

function parseRecord(value: unknown): RivalryRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const candidate = value as {
    version?: unknown;
    recordedAt?: unknown;
    receipt?: unknown;
  };
  if (
    candidate.version !== 1 ||
    typeof candidate.recordedAt !== "number" ||
    !Number.isSafeInteger(candidate.recordedAt) ||
    candidate.recordedAt < 0
  ) {
    return null;
  }
  const receipt = canonicalReceipt(candidate.receipt);
  return receipt
    ? { version: 1, recordedAt: candidate.recordedAt, receipt }
    : null;
}

function canonicalReceipt(value: unknown): FriendReceipt | null {
  try {
    if (typeof value !== "object" || value === null) return null;
    const encoded = friendReceiptPath(value as FriendReceipt).slice(
      RECEIPT_PREFIX.length,
    );
    return parseFriendReceipt(encoded);
  } catch {
    return null;
  }
}
