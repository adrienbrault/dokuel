import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyUpdate, Doc, encodeStateAsUpdate } from "yjs";
import type { Difficulty } from "../lib/types.ts";
import { createFakeConnections } from "./mp-connection.fake.ts";
import {
  claimWinner,
  initializeRoom,
  joinRoom,
  setDifficulty,
  startGame,
} from "./p2p-room.ts";
import { useYjsMultiplayer } from "./useYjsMultiplayer.ts";

// The transport is injected, not module-mocked: the in-memory adapter
// is the second implementation of the same Connection seam the WebRTC
// one satisfies, so these tests exercise the hook's real wiring.
let connections: ReturnType<typeof createFakeConnections>;

beforeEach(() => {
  connections = createFakeConnections();
});

function renderRoom({
  roomId,
  difficulty,
}: {
  roomId: string;
  difficulty: Difficulty | null;
}) {
  return renderHook(() =>
    useYjsMultiplayer({
      roomId,
      playerId: "p1",
      playerName: "Alice",
      difficulty,
      openConnection: connections.open,
    }),
  );
}

// Flush the whenSynced microtask + resulting React effect so post-sync
// init has run before tests assert on state.
async function flushSync() {
  await act(async () => {});
}

// Force document.hidden + dispatch the visibilitychange event so the
// hook's listener fires. jsdom defaults to hidden=false and exposes
// the property as a getter, so we redefine it per call.
function setTabHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

function countClues(puzzle: string): number {
  return puzzle.split("").filter((c) => c !== ".").length;
}

describe("useYjsMultiplayer", () => {
  it("host writes chosen difficulty to Yjs on mount", async () => {
    const { result } = renderRoom({ roomId: "abc123", difficulty: "expert" });

    await flushSync();
    expect(result.current.roomState?.difficulty).toBe("expert");
  });

  it("joiner with null difficulty does not initialize the room", async () => {
    // Joiners came in via a shared link with no chosen difficulty, so
    // they must not write any room defaults — initialization (and the
    // host claim it bundles with) is reserved for the creator so the
    // joiner never races for hostId.
    renderRoom({ roomId: "room-joiner", difficulty: null });

    await flushSync();
    const doc = connections.last!.doc;
    const roomMap = doc.getMap("room");
    expect(roomMap.get("difficulty")).toBeUndefined();
    expect(roomMap.get("hostId")).toBeUndefined();
    expect(roomMap.get("status")).toBeUndefined();
  });

  it("sendStartGame uses Yjs difficulty, not the local prop", async () => {
    const { result } = renderRoom({ roomId: "room-start", difficulty: "easy" });

    await flushSync();
    const doc = connections.last!.doc;
    const fakeRoom = { doc, roomId: "room-start" };

    // Simulate opponent joining and host switching to expert via Yjs.
    act(() => {
      joinRoom(fakeRoom, "p2", "Bob");
      setDifficulty(fakeRoom, "expert");
    });

    act(() => {
      result.current.sendStartGame();
    });

    const puzzle = doc.getMap("room").get("puzzle") as string;
    expect(puzzle).toBeTruthy();
    // Expert digs to a minimal puzzle (~22-28 clues) — well below the
    // easy band (36-45) the local prop would have produced.
    expect(countClues(puzzle)).toBeGreaterThanOrEqual(17);
    expect(countClues(puzzle)).toBeLessThanOrEqual(28);
  });

  it("setDifficulty updates the Yjs room difficulty", async () => {
    const { result } = renderRoom({ roomId: "room-set", difficulty: "easy" });

    await flushSync();
    const doc = connections.last!.doc;
    expect(doc.getMap("room").get("difficulty")).toBe("easy");

    act(() => {
      result.current.setDifficulty("hard");
    });

    expect(doc.getMap("room").get("difficulty")).toBe("hard");
  });

  it("closes the connection on unmount", async () => {
    const { unmount } = renderRoom({
      roomId: "room-idb-destroy",
      difficulty: "easy",
    });

    await flushSync();
    expect(connections.last!.closed).toBe(false);
    unmount();
    expect(connections.last!.closed).toBe(true);
  });

  it("keeps the same Y.Doc when playerName changes", async () => {
    const { rerender } = renderHook(
      ({ playerName }: { playerName: string }) =>
        useYjsMultiplayer({
          roomId: "room-rename",
          playerId: "p1",
          playerName,
          difficulty: "easy",
          openConnection: connections.open,
        }),
      { initialProps: { playerName: "Alice" } },
    );

    await flushSync();
    const docBefore = connections.last?.doc;
    expect(docBefore).not.toBeNull();

    rerender({ playerName: "Alice Renamed" });
    await flushSync();

    expect(connections.last?.doc).toBe(docBefore);
  });

  it("sendRematch uses Yjs difficulty, not the local prop", async () => {
    const { result } = renderRoom({
      roomId: "room-rematch",
      difficulty: "easy",
    });

    await flushSync();
    const doc = connections.last!.doc;
    const fakeRoom = { doc, roomId: "room-rematch" };

    act(() => {
      joinRoom(fakeRoom, "p2", "Bob");
      setDifficulty(fakeRoom, "expert");
      result.current.sendStartGame();
    });

    act(() => {
      result.current.sendRematch();
    });

    const puzzle = doc.getMap("room").get("puzzle") as string;
    // Expert digs to a minimal puzzle (~22-28 clues) — well below the
    // easy band (36-45) the local prop would have produced.
    expect(countClues(puzzle)).toBeGreaterThanOrEqual(17);
    expect(countClues(puzzle)).toBeLessThanOrEqual(28);
  });

  it("preserves persisted gameNumber, puzzle, and solution across a fresh mount", async () => {
    // Build a seed update representing a previously-saved doc: a
    // started game with two players. Without the whenSynced gate, the
    // hook's synchronous joinRoom + initializeRoom would race the IDB
    // restore and the persisted state would be lost over multiple iOS
    // reloads. This test guards the fix.
    const seedDoc = new Doc();
    const seedRoom = { doc: seedDoc, roomId: "room-preserves" };
    initializeRoom(seedRoom, "p1", "medium");
    joinRoom(seedRoom, "p1", "Alice");
    joinRoom(seedRoom, "p2", "Bob");
    startGame(seedRoom);
    const seedGameNumber = seedDoc.getMap("room").get("gameNumber") as number;
    const seedPuzzle = seedDoc.getMap("room").get("puzzle") as string;
    const seedSolution = seedDoc.getMap("room").get("solution") as string;
    expect(seedGameNumber).toBeGreaterThan(0);
    expect(seedPuzzle).toBeTruthy();
    expect(seedSolution).toBeTruthy();

    connections.persistedUpdate = encodeStateAsUpdate(seedDoc);

    const { result } = renderRoom({
      roomId: "room-preserves",
      difficulty: null,
    });

    await flushSync();

    expect(result.current.hasStartedGame).toBe(true);
    expect(result.current.puzzle).toBe(seedPuzzle);
    expect(result.current.solution).toBe(seedSolution);
    expect(result.current.roomState?.gameNumber).toBe(seedGameNumber);
    expect(result.current.roomState?.status).toBe("playing");
    expect(result.current.roomState?.players).toHaveLength(2);
  });

  it("flags roomFull for a third player arriving at a full room", async () => {
    // Seed IDB with a room that already has two other players, so the
    // join attempt no-ops and this client learns it is the odd one out.
    const seedDoc = new Doc();
    const seedRoom = { doc: seedDoc, roomId: "room-full" };
    initializeRoom(seedRoom, "p2", "medium");
    joinRoom(seedRoom, "p2", "Bob");
    joinRoom(seedRoom, "p3", "Carol");
    connections.persistedUpdate = encodeStateAsUpdate(seedDoc);

    const { result } = renderRoom({ roomId: "room-full", difficulty: null });

    await flushSync();
    expect(result.current.roomFull).toBe(true);
    expect(result.current.roomState?.players).toHaveLength(2);
  });

  it("re-raises an identical error so the toast can show again", async () => {
    // "Need 2 players to start" twice in a row: a string state field
    // is Object.is-equal on the second set, so the consumer's effect
    // never re-fires and the second tap silently does nothing.
    const { result } = renderRoom({
      roomId: "room-error-retoast",
      difficulty: "easy",
    });
    await flushSync();

    act(() => {
      result.current.sendStartGame();
    });
    const first = result.current.error;
    expect(first?.message).toBe("Need 2 players to start");

    act(() => {
      result.current.sendStartGame();
    });
    expect(result.current.error?.message).toBe("Need 2 players to start");
    expect(result.current.error).not.toBe(first);
  });

  describe("win claims", () => {
    async function setupStartedGame(roomId: string) {
      const { result } = renderRoom({ roomId, difficulty: "easy" });
      await flushSync();
      const doc = connections.last!.doc;
      const fakeRoom = { doc, roomId };
      act(() => {
        joinRoom(fakeRoom, "p2", "Bob");
        startGame(fakeRoom);
      });
      await flushSync();
      const solution = doc.getMap("room").get("solution") as string;
      return { result, doc, fakeRoom, solution };
    }

    it("claimForfeitWin no-ops when the opponent's presence is back", async () => {
      // The 60s countdown races the opponent's reconnect: if their
      // awareness reappeared by the time the claim fires, taking the
      // forfeit would steamroll a player who just came back.
      const { result, doc } = await setupStartedGame("room-claim-returned");
      const { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } =
        await import("y-protocols/awareness");
      const otherDoc = new Doc();
      const otherAwareness = new Awareness(otherDoc);
      otherAwareness.setLocalStateField("user", { id: "p2", name: "Bob" });
      act(() => {
        applyAwarenessUpdate(
          connections.last!.awareness,
          encodeAwarenessUpdate(otherAwareness, [otherDoc.clientID]),
          "test",
        );
      });

      act(() => {
        result.current.claimForfeitWin();
      });

      expect(doc.getMap("room").get("winnerId")).toBeNull();
      otherAwareness.destroy();
    });
  });

  describe("visibility-driven WebRTC lifecycle", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      setTabHidden(false);
    });

    afterEach(() => {
      // The hook is still mounted here (RTL auto-cleanup runs after
      // this), and un-hiding dispatches visibilitychange into it.
      act(() => {
        setTabHidden(false);
      });
      vi.useRealTimers();
    });

    it("disconnects the WebRTC provider after the hide debounce", async () => {
      renderRoom({ roomId: "room-hide", difficulty: "easy" });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      const provider = connections.last!;
      provider.connected = true;
      provider.disconnectCount = 0;

      act(() => {
        setTabHidden(true);
      });
      expect(provider.disconnectCount).toBe(0);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000);
      });
      expect(provider.disconnectCount).toBe(1);
      expect(provider.connected).toBe(false);
    });

    it("does not disconnect if the tab returns before the debounce", async () => {
      renderRoom({ roomId: "room-hide-cancel", difficulty: "easy" });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      const provider = connections.last!;
      provider.connected = true;
      provider.disconnectCount = 0;

      act(() => {
        setTabHidden(true);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });
      act(() => {
        setTabHidden(false);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_000);
      });

      expect(provider.disconnectCount).toBe(0);
    });

    it("reconnects when the tab returns after disconnecting", async () => {
      renderRoom({ roomId: "room-rejoin", difficulty: "easy" });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      const provider = connections.last!;
      provider.connected = true;
      provider.connectCount = 0;

      act(() => {
        setTabHidden(true);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000);
      });
      expect(provider.connected).toBe(false);

      act(() => {
        setTabHidden(false);
      });
      expect(provider.connectCount).toBe(1);
      expect(provider.connected).toBe(true);
    });

    it("re-announces presence after the reconnect", async () => {
      renderRoom({ roomId: "room-reannounce", difficulty: "easy" });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      const provider = connections.last!;
      provider.connected = true;

      act(() => {
        setTabHidden(true);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000);
      });
      // The disconnect wiped our awareness entry — from the opponent's
      // point of view we vanished.
      expect(provider.awareness.getLocalState()).toBeNull();

      act(() => {
        setTabHidden(false);
      });
      // Without a working re-announce the opponent keeps seeing us as
      // disconnected forever and is offered a forfeit win while we are
      // actively playing.
      expect(provider.awareness.getLocalState()?.user).toEqual({
        id: "p1",
        name: "Alice",
      });
    });

    it("accepts a forfeit claim after we really were away", async () => {
      const { result } = renderRoom({
        roomId: "room-forfeit-away",
        difficulty: "easy",
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      const doc = connections.last!.doc;
      const fakeRoom = { doc, roomId: "room-forfeit-away" };
      act(() => {
        joinRoom(fakeRoom, "p2", "Bob");
        startGame(fakeRoom);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // We disappear long enough for the WebRTC drop, then return; the
      // opponent's forfeit claim lands right after. That absence was
      // real, so the claim must be honored.
      act(() => {
        setTabHidden(true);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000);
      });
      act(() => {
        setTabHidden(false);
      });
      act(() => {
        claimWinner(fakeRoom, "p2", "Bob", null);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(result.current.gameOver).toEqual({
        winnerId: "p2",
        winnerName: "Bob",
      });
    });

    it("does not flag opponent as disconnected while we are the hidden one", async () => {
      const { result } = renderRoom({
        roomId: "room-hide-flag",
        difficulty: "easy",
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      const doc = connections.last!.doc;
      const fakeRoom = { doc, roomId: "room-hide-flag" };
      // Two players in the doc, no awareness peers → before the fix
      // this would flip to true. With the !document.hidden gate it
      // must stay false because *we* are the one going away.
      await act(async () => {
        joinRoom(fakeRoom, "p2", "Bob");
        setTabHidden(true);
      });
      expect(result.current.opponentDisconnected).toBe(false);
    });
  });

  describe("localStorage snapshot fallback", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    function seedSnapshot(roomId: string) {
      localStorage.setItem(
        `dokuel_mp_snap_${roomId}`,
        JSON.stringify({
          gameNumber: 4,
          puzzle: ".".repeat(81),
          status: "playing",
          difficulty: "hard",
          assistLevel: "standard",
          hostId: "p1",
          players: [
            {
              id: "p1",
              name: "Alice",
              color: "#3B82F6",
              cellsRemaining: 30,
              completionPercent: 63,
            },
            {
              id: "p2",
              name: "Bob",
              color: "#EF4444",
              cellsRemaining: 25,
              completionPercent: 69,
            },
          ],
          winnerId: null,
          winnerName: null,
          savedAt: Date.now(),
        }),
      );
    }

    it("hydrates from snapshot when IndexedDB returns no started game", async () => {
      vi.useFakeTimers();
      try {
        seedSnapshot("room-hydrate");

        const { result } = renderRoom({
          roomId: "room-hydrate",
          difficulty: null,
        });

        // The snapshot is applied only after a grace window in which no
        // live peer state arrived.
        await act(async () => {
          await vi.advanceTimersByTimeAsync(3_000);
        });

        expect(result.current.hasStartedGame).toBe(true);
        expect(result.current.puzzle).toBe(".".repeat(81));
        expect(result.current.roomState?.gameNumber).toBe(4);
        expect(result.current.roomState?.difficulty).toBe("hard");
      } finally {
        vi.useRealTimers();
      }
    });

    it("prefers live peer state that arrives during the hydration grace window", async () => {
      // Hydrating a ≤1h-old snapshot into a FRESH doc makes every key
      // causally concurrent with the live room — per-key LWW can then
      // roll a finished/advanced game back for both peers. When real
      // state arrives first, the snapshot must stay unapplied.
      vi.useFakeTimers();
      try {
        seedSnapshot("room-snap-race");

        const { result } = renderRoom({
          roomId: "room-snap-race",
          difficulty: null,
        });
        // Make our writes win LWW ties so a premature hydration is
        // deterministically visible instead of a clientID coin flip.
        connections.last!.doc.clientID = 0x7fffffff;

        await act(async () => {
          await vi.advanceTimersByTimeAsync(1_000);
        });

        // The peer's real room arrives over WebRTC: game 7, different
        // puzzle, already finished.
        const seedDoc = new Doc();
        const seedRoom = { doc: seedDoc, roomId: "room-snap-race" };
        initializeRoom(seedRoom, "p2", "medium");
        joinRoom(seedRoom, "p2", "Bob");
        joinRoom(seedRoom, "p1", "Alice");
        for (let i = 0; i < 7; i++) startGame(seedRoom);
        act(() => {
          applyUpdate(connections.last!.doc, encodeStateAsUpdate(seedDoc));
        });

        await act(async () => {
          await vi.advanceTimersByTimeAsync(5_000);
        });

        expect(result.current.roomState?.gameNumber).toBe(7);
        expect(result.current.roomState?.difficulty).toBe("medium");
      } finally {
        vi.useRealTimers();
      }
    });

    it("does not hydrate when IndexedDB already has a started game", async () => {
      const seedDoc = new Doc();
      const seedRoom = { doc: seedDoc, roomId: "room-no-hydrate" };
      initializeRoom(seedRoom, "p1", "medium");
      joinRoom(seedRoom, "p1", "Alice");
      joinRoom(seedRoom, "p2", "Bob");
      for (let i = 0; i < 7; i++) startGame(seedRoom);
      connections.persistedUpdate = encodeStateAsUpdate(seedDoc);

      localStorage.setItem(
        "dokuel_mp_snap_room-no-hydrate",
        JSON.stringify({
          gameNumber: 2,
          puzzle: "1".padEnd(81, "."),
          status: "playing",
          difficulty: "easy",
          assistLevel: "standard",
          hostId: "p1",
          players: [],
          winnerId: null,
          winnerName: null,
          savedAt: Date.now(),
        }),
      );

      const { result } = renderRoom({
        roomId: "room-no-hydrate",
        difficulty: null,
      });

      await flushSync();

      expect(result.current.roomState?.gameNumber).toBe(7);
      expect(result.current.roomState?.difficulty).not.toBe("easy");
    });

    it("writes a snapshot to localStorage on pagehide", async () => {
      const { result } = renderRoom({
        roomId: "room-pagehide",
        difficulty: "easy",
      });
      await flushSync();
      const doc = connections.last!.doc;
      const fakeRoom = { doc, roomId: "room-pagehide" };
      act(() => {
        joinRoom(fakeRoom, "p2", "Bob");
        result.current.sendStartGame();
      });

      expect(localStorage.getItem("dokuel_mp_snap_room-pagehide")).toBeNull();
      act(() => {
        window.dispatchEvent(new Event("pagehide"));
      });
      const raw = localStorage.getItem("dokuel_mp_snap_room-pagehide");
      expect(raw).not.toBeNull();
      const snap = JSON.parse(raw!);
      expect(snap.gameNumber).toBeGreaterThan(0);
      expect(snap.players).toHaveLength(2);
    });
  });
});
