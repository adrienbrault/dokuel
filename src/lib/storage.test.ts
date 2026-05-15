import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readJson, removeKey, writeJson } from "./storage.ts";

const KEY = "storage-test-key";

describe("storage", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  describe("readJson", () => {
    it("returns fallback when key is missing", () => {
      expect(readJson(KEY, { count: 0 })).toEqual({ count: 0 });
    });

    it("returns parsed value when present and valid JSON", () => {
      localStorage.setItem(KEY, JSON.stringify({ count: 7 }));
      expect(readJson(KEY, { count: 0 })).toEqual({ count: 7 });
    });

    it("returns fallback when JSON.parse throws", () => {
      localStorage.setItem(KEY, "{not json");
      expect(readJson<{ count: number }>(KEY, { count: 0 })).toEqual({
        count: 0,
      });
    });

    it("returns fallback when validator returns null", () => {
      localStorage.setItem(KEY, JSON.stringify({ unexpected: "shape" }));
      const validate = (v: unknown): { count: number } | null =>
        v && typeof (v as { count?: unknown }).count === "number"
          ? (v as { count: number })
          : null;
      expect(readJson(KEY, { count: 99 }, validate)).toEqual({ count: 99 });
    });

    it("returns validated value when validator accepts it", () => {
      localStorage.setItem(KEY, JSON.stringify({ count: 5 }));
      const validate = (v: unknown): { count: number } | null =>
        v && typeof (v as { count?: unknown }).count === "number"
          ? (v as { count: number })
          : null;
      expect(readJson(KEY, { count: 0 }, validate)).toEqual({ count: 5 });
    });

    it("returns a fresh fallback reference each call", () => {
      // Caller passes a literal — mutating one should not affect the next read.
      const a = readJson(KEY, { count: 0 });
      a.count = 99;
      const b = readJson(KEY, { count: 0 });
      expect(b.count).toBe(0);
    });
  });

  describe("writeJson", () => {
    it("serializes and writes to localStorage", () => {
      writeJson(KEY, { name: "x" });
      expect(localStorage.getItem(KEY)).toBe('{"name":"x"}');
    });
  });

  describe("removeKey", () => {
    it("removes an existing key", () => {
      localStorage.setItem(KEY, "anything");
      removeKey(KEY);
      expect(localStorage.getItem(KEY)).toBe(null);
    });
  });
});
