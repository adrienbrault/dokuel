import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  exportResultStore,
  getRecentResultsForOrigin,
  getSummary,
  importResultStore,
  recordResult,
  validateResultStore,
} from "./result-store.ts";

describe("result-store backup", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("exports a durable envelope and restores it after recent history is cleared", () => {
    recordResult({
      difficulty: "expert",
      assistLevel: "paper",
      time: 91,
      won: true,
      metadata: {
        origin: "friend",
        attemptId: "friend-attempt",
        puzzleId: "friend-puzzle",
      },
    });

    const backup = exportResultStore();
    expect(backup.version).toBe(1);
    expect(backup.recent).toHaveLength(1);
    expect(backup.lifetime.buckets).not.toEqual({});

    localStorage.clear();
    expect(importResultStore(backup)).toBe(true);
    expect(getRecentResultsForOrigin("friend")).toHaveLength(1);
    expect(getSummary("expert", "paper", "friend")).toEqual({
      gamesPlayed: 1,
      bestTime: 91,
      averageTime: 91,
    });
  });

  it("rejects unknown or malformed versions without changing current results", () => {
    recordResult({
      difficulty: "easy",
      assistLevel: "standard",
      time: 30,
      won: true,
    });
    const before = exportResultStore();

    expect(validateResultStore({ ...before, version: 2 })).toBeNull();
    expect(importResultStore({ ...before, version: 2 })).toBe(false);
    expect(importResultStore({ version: 1 })).toBe(false);
    expect(exportResultStore()).toEqual(before);
  });

  it("rejects malformed nested envelopes without changing current results", () => {
    recordResult({
      difficulty: "easy",
      assistLevel: "standard",
      time: 30,
      won: true,
      metadata: { attemptId: "keep" },
    });
    const before = exportResultStore();
    const invalidStores: unknown[] = [
      "not json",
      null,
      42,
      {},
      { ...before, recent: null },
      { ...before, recent: [{ difficulty: "invalid" }] },
      { ...before, lifetime: null },
      { ...before, lifetime: { ...before.lifetime, buckets: null } },
      { ...before, attempts: null },
      {
        ...before,
        attempts: {
          ...before.attempts,
          broken: { difficulty: "invalid" },
        },
      },
    ];

    for (const invalid of invalidStores) {
      expect(validateResultStore(invalid)).toBeNull();
      expect(importResultStore(invalid)).toBe(false);
    }

    expect(exportResultStore()).toEqual(before);
  });

  it("classifies a repeated puzzle as replay after its original leaves recent history", () => {
    recordResult({
      difficulty: "easy",
      assistLevel: "standard",
      time: 30,
      won: true,
      metadata: {
        origin: "generated",
        attemptId: "original",
        puzzleId: "same-puzzle",
      },
    });
    for (let index = 0; index < 100; index++) {
      recordResult({
        difficulty: "easy",
        assistLevel: "standard",
        time: 100 + index,
        won: true,
        metadata: {
          origin: "generated",
          attemptId: `other-${index}`,
          puzzleId: `other-puzzle-${index}`,
        },
      });
    }

    expect(getRecentResultsForOrigin("generated")).toHaveLength(100);
    const replay = recordResult({
      difficulty: "easy",
      assistLevel: "standard",
      time: 25,
      won: true,
      metadata: {
        origin: "generated",
        attemptId: "replay-attempt",
        puzzleId: "same-puzzle",
      },
    });

    expect(replay.record.origin).toBe("replay");
    expect(getRecentResultsForOrigin("replay")).toHaveLength(1);
    expect(getSummary("easy", "standard", "generated")?.gamesPlayed).toBe(101);
  });

  it("handles prototype-named attempt IDs as ordinary own records", () => {
    const first = recordResult({
      difficulty: "easy",
      assistLevel: "standard",
      time: 30,
      won: true,
      metadata: { attemptId: "toString" },
    });
    const duplicate = recordResult({
      difficulty: "easy",
      assistLevel: "standard",
      time: 15,
      won: true,
      metadata: { attemptId: "toString" },
    });

    expect(first.duplicate).toBe(false);
    expect(duplicate.duplicate).toBe(true);
    expect(getSummary("easy", "standard")?.gamesPlayed).toBe(1);
  });

  it("reports a failed write and allows the same result to be retried", () => {
    recordResult({
      difficulty: "easy",
      assistLevel: "standard",
      time: 30,
      won: true,
      metadata: { attemptId: "before" },
    });
    const persistedBefore = exportResultStore();
    const originalSetItem = Storage.prototype.setItem;
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, key, value) {
        if (key === "sudoku_result_store") throw new Error("quota");
        return originalSetItem.call(this, key, value);
      });
    let failed: ReturnType<typeof recordResult> | undefined;
    try {
      failed = recordResult({
        difficulty: "easy",
        assistLevel: "standard",
        time: 20,
        won: true,
        metadata: { attemptId: "retry" },
      });
    } finally {
      spy.mockRestore();
    }

    expect(failed?.persisted).toBe(false);
    expect(exportResultStore()).toEqual(persistedBefore);
    const retried = recordResult({
      difficulty: "easy",
      assistLevel: "standard",
      time: 20,
      won: true,
      metadata: { attemptId: "retry" },
    });
    expect(retried.duplicate).toBe(false);
    expect(retried.persisted).toBe(true);
  });

  it("keeps current results when localStorage rejects the imported envelope", () => {
    recordResult({
      difficulty: "easy",
      assistLevel: "standard",
      time: 30,
      won: true,
    });
    const before = exportResultStore();
    const replacement = {
      ...before,
      recent: [],
      lifetime: { version: 1 as const, buckets: {} },
      attempts: {},
    };
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("quota");
    };
    try {
      expect(importResultStore(replacement)).toBe(false);
    } finally {
      Storage.prototype.setItem = originalSetItem;
    }
    expect(exportResultStore()).toEqual(before);
  });
});
