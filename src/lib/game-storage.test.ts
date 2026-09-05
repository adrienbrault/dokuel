import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteGame,
  exportSavedGames,
  listSavedGames,
  loadGame,
  replaceSavedGames,
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
    expect(loadGame("k")).toEqual(VALID_GAME);
  });

  it("reports whether a save was accepted by localStorage", () => {
    expect(saveGame("accepted", VALID_GAME)).toBe(true);
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("quota");
    };
    try {
      expect(saveGame("rejected", VALID_GAME)).toBe(false);
    } finally {
      Storage.prototype.setItem = originalSetItem;
    }
  });

  it("exports portable solo saves while keeping multiplayer identity private", () => {
    saveGame("solo", VALID_GAME);
    saveGame("mp_room_2_player_puzzle", {
      ...VALID_GAME,
      multiplayer: {
        roomId: "room",
        playerId: "secret-player",
        gameNumber: 2,
        puzzle: VALID_GAME.puzzle,
      },
    });

    expect(exportSavedGames()).toEqual([{ key: "solo", data: VALID_GAME }]);
  });

  it("replaces portable saves and preserves multiplayer saves", () => {
    saveGame("old", VALID_GAME);
    const multiplayer = {
      ...VALID_GAME,
      multiplayer: {
        roomId: "room",
        playerId: "secret-player",
        gameNumber: 2,
        puzzle: VALID_GAME.puzzle,
      },
    };
    saveGame("mp_room_2_player_puzzle", multiplayer);

    expect(replaceSavedGames([{ key: "new", data: VALID_GAME }])).toBe(true);
    expect(loadGame("old")).toBeNull();
    expect(loadGame("new")).toEqual(VALID_GAME);
    expect(loadGame("mp_room_2_player_puzzle")).toEqual(multiplayer);
  });

  it("rejects an invalid replacement before changing existing saves", () => {
    saveGame("old", VALID_GAME);
    expect(
      replaceSavedGames([{ key: "bad", data: { ...VALID_GAME, puzzle: "x" } }]),
    ).toBe(false);
    expect(loadGame("old")).toEqual(VALID_GAME);
  });

  it("identifies the room when listing a legacy multiplayer save", () => {
    saveGame("mp_calm-lamb-g4bb_123.........", VALID_GAME);
    expect(listSavedGames()).toEqual([
      expect.objectContaining({ roomId: "calm-lamb-g4bb" }),
    ]);
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
