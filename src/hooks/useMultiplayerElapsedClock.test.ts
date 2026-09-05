import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type {
  MultiplayerGameIdentity,
  SavedGame,
} from "../lib/game-storage.ts";
import { useMultiplayerElapsedClock } from "./useMultiplayerElapsedClock.ts";

const identity: MultiplayerGameIdentity = {
  roomId: "room-clock",
  playerId: "player-1",
  gameNumber: 1,
  puzzle: ".".repeat(81),
};

const saved: SavedGame = {
  puzzle: identity.puzzle,
  values: identity.puzzle,
  notes: Array.from({ length: 81 }, () => []),
  timer: 2.25,
  difficulty: "easy",
  assistLevel: "standard",
  hintsUsed: 0,
};

describe("useMultiplayerElapsedClock", () => {
  it("uses wall time after a delayed callback for a legacy save", () => {
    let now = 1_000;
    const { result } = renderHook(() =>
      useMultiplayerElapsedClock({
        identity,
        saved,
        running: true,
        now: () => now,
      }),
    );

    now += 3_500.5;

    expect(result.current.elapsedClock.getElapsedSeconds()).toBe(5.7505);
  });

  it("counts the shared start gap after a remount", () => {
    let now = 10_000;
    const { result, unmount } = renderHook(() =>
      useMultiplayerElapsedClock({
        identity,
        saved: null,
        running: true,
        startedAt: 1_000,
        now: () => now,
      }),
    );

    expect(result.current.elapsedClock.getElapsedSeconds()).toBe(9);
    unmount();

    now = 16_000;
    const remounted = renderHook(() =>
      useMultiplayerElapsedClock({
        identity,
        saved: null,
        running: true,
        startedAt: 1_000,
        now: () => now,
      }),
    );

    expect(remounted.result.current.elapsedClock.getElapsedSeconds()).toBe(15);
    remounted.unmount();
  });
});
