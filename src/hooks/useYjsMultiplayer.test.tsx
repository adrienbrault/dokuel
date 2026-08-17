import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Doc, encodeStateAsUpdate } from "yjs";
import type { Difficulty } from "../lib/types.ts";
import { createFakeConnections } from "./mp-connection.fake.ts";
import {
  claimWinner,
  initializeRoom,
  joinRoom,
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

describe("useYjsMultiplayer", () => {
  it("closes a connection that finishes opening after unmount", async () => {
    // Opening is async (relay credentials first); a room the player left
    // during that window must not leave a live transport behind.
    const { unmount } = renderRoom({
      roomId: "room-late-open",
      difficulty: "easy",
    });
    unmount();

    await flushSync();

    expect(connections.last!.closed).toBe(true);
  });

  it("builds one transport when the room remounts while opening", async () => {
    // React StrictMode double-invokes effects, so the first mount's
    // open is still in flight when the second one starts. y-webrtc
    // keeps ONE global registry keyed by room name: a transport built
    // for the abandoned open claims the room's slot, and the live
    // one's own claim throws inside a detached promise — leaving the
    // lobby permanently disconnected.
    const first = renderRoom({ roomId: "room-remount", difficulty: "easy" });
    first.unmount();
    const second = renderRoom({ roomId: "room-remount", difficulty: "easy" });

    await flushSync();

    expect(connections.all).toHaveLength(1);
    expect(connections.last?.closed).toBe(false);
    second.unmount();
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

  it("reports the transport's connection status", async () => {
    const { result } = renderRoom({
      roomId: "room-status",
      difficulty: "easy",
    });
    await flushSync();
    expect(result.current.connected).toBe(false);

    act(() => {
      connections.last!.emitStatus(true);
    });

    expect(result.current.connected).toBe(true);
  });

  it("records a transport drop as an absence the Room can trust", async () => {
    // Losing signaling is the other way we go away (the hidden-tab path
    // is covered below). A forfeit claim landing afterwards is real.
    const { result } = renderRoom({
      roomId: "room-status-absence",
      difficulty: "easy",
    });
    await flushSync();
    const doc = connections.last!.doc;
    const fakeRoom = { doc, roomId: "room-status-absence" };
    act(() => {
      joinRoom(fakeRoom, "p2", "Bob");
      startGame(fakeRoom);
    });

    act(() => {
      connections.last!.emitStatus(false);
    });
    act(() => {
      claimWinner(fakeRoom, "p2", "Bob", null);
    });

    expect(result.current.gameOver).toEqual({
      winnerId: "p2",
      winnerName: "Bob",
    });
  });

  it("recomputes presence when the peer set changes", async () => {
    const { result } = renderRoom({ roomId: "room-peers", difficulty: "easy" });
    await flushSync();
    const doc = connections.last!.doc;
    act(() => {
      joinRoom({ doc, roomId: "room-peers" }, "p2", "Bob");
    });
    expect(result.current.opponentDisconnected).toBe(false);

    act(() => {
      connections.last!.emitPresence();
    });

    expect(result.current.opponentDisconnected).toBe(true);
  });

  it("routes each command through to the room", async () => {
    // The binding's job for these is delegation and nothing else; the
    // rules behind them are tested against the Room.
    const { result } = renderRoom({
      roomId: "room-commands",
      difficulty: "easy",
    });
    await flushSync();
    const doc = connections.last!.doc;
    act(() => {
      joinRoom({ doc, roomId: "room-commands" }, "p2", "Bob");
    });

    act(() => {
      result.current.setDifficulty("hard");
      result.current.setAssistLevel("paper");
      result.current.updateName("Alicia");
      result.current.sendStartGame();
    });
    const solution = doc.getMap("room").get("solution") as string;
    act(() => {
      result.current.sendComplete(solution);
    });
    expect(doc.getMap("room").get("winnerId")).toBe("p1");

    act(() => {
      result.current.sendProgress(7, 91);
      result.current.sendRematch();
    });

    const roomMap = doc.getMap("room");
    expect(roomMap.get("difficulty")).toBe("hard");
    expect(roomMap.get("assistLevel")).toBe("paper");
    expect(roomMap.get("gameNumber")).toBe(2);
    expect(result.current.roomState?.players[0]?.name).toBe("Alicia");
    // The rematch resets progress, so assert the write landed before it.
    expect(connections.last!.awareness.getLocalState()?.user).toEqual({
      id: "p1",
      name: "Alicia",
    });
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
