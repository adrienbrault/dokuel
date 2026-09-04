import { beforeEach, describe, expect, it } from "vitest";
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
