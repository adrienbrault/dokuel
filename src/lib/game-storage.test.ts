import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteGame,
  listSavedGames,
  loadGame,
  pruneAbandonedSaves,
  type SavedGame,
  saveGame,
} from "./game-storage.ts";

const VALID_PUZZLE = `${"1".repeat(1)}${".".repeat(80)}`;
const VALID_GAME: SavedGame = {
  puzzle: VALID_PUZZLE,
  values: `${"1".repeat(1)}${"2".repeat(1)}${".".repeat(79)}`,
  notes: Array.from({ length: 81 }, () => []),
  timer: 42,
  difficulty: "medium",
  assistLevel: "standard",
  hintsUsed: 0,
};

describe("game-storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips a saved game", () => {
    saveGame("k", VALID_GAME);
    // toMatchObject: the store also stamps updatedAt, which callers
    // hand back to nobody.
    expect(loadGame("k")).toMatchObject(VALID_GAME);
  });

  it("returns null for a missing key", () => {
    expect(loadGame("nope")).toBeNull();
  });

  it("deletes a saved game", () => {
    saveGame("k", VALID_GAME);
    deleteGame("k");
    expect(loadGame("k")).toBeNull();
  });

  it("defaults hintsUsed to 0 for saves written before the field existed", () => {
    const { hintsUsed: _drop, ...legacy } = VALID_GAME;
    localStorage.setItem("sudoku_save_k", JSON.stringify(legacy));
    expect(loadGame("k")?.hintsUsed).toBe(0);
  });

  it("coerces a corrupt hintsUsed to 0 instead of dropping the save", () => {
    localStorage.setItem(
      "sudoku_save_k",
      JSON.stringify({ ...VALID_GAME, hintsUsed: "lol" }),
    );
    expect(loadGame("k")?.hintsUsed).toBe(0);
  });

  // A corrupt save is re-read on every app load; anything loadGame lets
  // through flows straight into initState during render, where a bad
  // character or non-array note entry throws and white-screens the app.
  describe("rejects corrupt saves instead of letting them crash the render", () => {
    it("rejects puzzle strings with invalid characters", () => {
      saveGame("k", { ...VALID_GAME, puzzle: "x".repeat(81) });
      expect(loadGame("k")).toBeNull();
    });

    it("rejects values strings with invalid characters", () => {
      saveGame("k", { ...VALID_GAME, values: "0".repeat(81) });
      expect(loadGame("k")).toBeNull();
    });

    it("rejects non-array note entries", () => {
      const notes = Array.from({ length: 81 }, () => []) as unknown[];
      notes[40] = 7;
      saveGame("k", { ...VALID_GAME, notes: notes as number[][] });
      expect(loadGame("k")).toBeNull();
    });

    it("rejects note digits outside 1-9", () => {
      const notes = Array.from({ length: 81 }, (): number[] => []);
      notes[40] = [1, 12];
      saveGame("k", { ...VALID_GAME, notes });
      expect(loadGame("k")).toBeNull();
    });

    it("rejects a non-finite timer", () => {
      saveGame("k", { ...VALID_GAME, timer: Number.NaN });
      expect(loadGame("k")).toBeNull();
    });
  });
});

describe("listSavedGames", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lists the most recently played game first", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T10:00:00Z"));
    saveGame("older", VALID_GAME);
    vi.setSystemTime(new Date("2026-01-02T10:00:00Z"));
    saveGame("newer", VALID_GAME);
    expect(listSavedGames().map((g) => g.key)).toEqual(["newer", "older"]);
  });

  it("omits a board the player never touched", () => {
    saveGame("untouched", { ...VALID_GAME, values: VALID_PUZZLE });
    expect(listSavedGames()).toEqual([]);
  });

  it("keeps a board whose only progress is pencil notes", () => {
    const notes = Array.from({ length: 81 }, (): number[] => []);
    notes[40] = [3, 7];
    saveGame("noted", { ...VALID_GAME, values: VALID_PUZZLE, notes });
    expect(listSavedGames().map((g) => g.key)).toEqual(["noted"]);
  });

  it("omits multiplayer saves — a duel board can't be resumed solo", () => {
    saveGame("solo-1", VALID_GAME);
    saveGame("mp_brave-otter-4f2a_1........", VALID_GAME);
    expect(listSavedGames().map((g) => g.key)).toEqual(["solo-1"]);
  });
});

describe("pruneAbandonedSaves", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("deletes a board abandoned before the first digit", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T10:00:00Z"));
    saveGame("untouched", { ...VALID_GAME, values: VALID_PUZZLE });
    saveGame("played", VALID_GAME);
    vi.setSystemTime(new Date("2026-01-03T10:00:00Z"));

    pruneAbandonedSaves();

    expect(loadGame("untouched")).toBeNull();
    expect(loadGame("played")).not.toBeNull();
  });

  it("spares a duel still being played in another tab", () => {
    saveGame("mp_brave-otter-4f2a_1........", VALID_GAME);

    pruneAbandonedSaves();

    expect(loadGame("mp_brave-otter-4f2a_1........")).not.toBeNull();
  });

  it("deletes a duel save the landing can no longer reach", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T10:00:00Z"));
    saveGame("mp_brave-otter-4f2a_1........", VALID_GAME);
    vi.setSystemTime(new Date("2026-01-03T10:00:00Z"));

    pruneAbandonedSaves();

    expect(loadGame("mp_brave-otter-4f2a_1........")).toBeNull();
  });
});
