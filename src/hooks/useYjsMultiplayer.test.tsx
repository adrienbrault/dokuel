import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Doc } from "yjs";
import type { Difficulty } from "../lib/types.ts";
import { createFakeConnections } from "./mp-connection.fake.ts";
import { createRoom, type Room } from "./mp-room.ts";
import { useYjsMultiplayer } from "./useYjsMultiplayer.ts";

/**
 * What is left for the binding to answer: does it build one room
 * session per mount, hand it the DOM events it cannot see, route the
 * commands to it, and close it on the way out. Every rule behind those
 * commands is tested against the Room, and every lifecycle policy
 * against the room session — neither needs React to be exercised.
 *
 * The transport is injected, not module-mocked: the in-memory adapter
 * is the second implementation of the same Connection seam the WebRTC
 * one satisfies, so these tests exercise the hook's real wiring.
 */
let connections: ReturnType<typeof createFakeConnections>;

beforeEach(() => {
  localStorage.clear();
  connections = createFakeConnections();
});

/** Play the opponent with a real Room over the same doc. */
function seatOpponent(doc: Doc, roomId: string, playerId: string): Room {
  const peer = createRoom({
    doc,
    // Every client keeps its own local snapshot, and jsdom hands them
    // all the same localStorage: sharing our room id would let the
    // peer's bookkeeping clear the snapshot under test.
    roomId: `peer-of-${roomId}`,
    playerId,
    playerName: () => "Bob",
    initialDifficulty: null,
    now: () => 0,
  });
  peer.apply({ type: "local-sync-complete", now: 0 });
  return peer;
}

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
  afterEach(() => {
    // The hook may still be mounted here (RTL auto-cleanup runs after
    // this), and un-hiding dispatches visibilitychange into it.
    act(() => {
      setTabHidden(false);
    });
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

  it("closes the session's connection on unmount", async () => {
    const { unmount } = renderRoom({
      roomId: "room-idb-destroy",
      difficulty: "easy",
    });

    await flushSync();
    expect(connections.last?.closed).toBe(false);
    unmount();
    expect(connections.last?.closed).toBe(true);
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
    expect(docBefore).not.toBeUndefined();

    rerender({ playerName: "Alice Renamed" });
    await flushSync();

    expect(connections.last?.doc).toBe(docBefore);
  });

  it("routes each command through to the session", async () => {
    // The binding's job for these is delegation and nothing else; the
    // rules behind them are tested against the Room.
    const { result } = renderRoom({
      roomId: "room-commands",
      difficulty: "easy",
    });
    await flushSync();
    const doc = connections.last?.doc as Doc;
    act(() => {
      seatOpponent(doc, "room-commands", "p2");
    });

    act(() => {
      result.current.setDifficulty("hard");
      result.current.setAssistLevel("paper");
      result.current.updateName("Alicia");
      result.current.sendStartGame();
    });
    const solution = result.current.solution as string;
    act(() => {
      result.current.sendComplete(solution);
    });
    expect(result.current.gameOver?.winnerId).toBe("p1");

    act(() => {
      result.current.sendProgress(7, 91);
      result.current.sendRematch();
    });

    expect(result.current.roomState?.difficulty).toBe("hard");
    expect(result.current.roomState?.assistLevel).toBe("paper");
    expect(result.current.roomState?.gameNumber).toBe(2);
    expect(result.current.roomState?.players[0]?.name).toBe("Alicia");
    // updateName also republishes presence, which lives on the
    // Connection — the binding must not be doing that itself.
    expect(connections.last?.awareness.getLocalState()?.user).toEqual({
      id: "p1",
      name: "Alicia",
    });
  });

  it("reports the connected flag the session projects", async () => {
    const { result } = renderRoom({
      roomId: "room-status",
      difficulty: "easy",
    });
    await flushSync();
    expect(result.current.connected).toBe(false);

    act(() => {
      connections.last?.emitStatus(true);
    });

    expect(result.current.connected).toBe(true);
  });

  it("forwards the tab's visibility and pagehide to the session", async () => {
    // The two events the session cannot see for itself. Both make it
    // mirror the room to local storage, which is the observable proof
    // they arrived.
    const { result } = renderRoom({
      roomId: "room-dom-events",
      difficulty: "easy",
    });
    await flushSync();
    const doc = connections.last?.doc as Doc;
    act(() => {
      seatOpponent(doc, "room-dom-events", "p2");
      result.current.sendStartGame();
    });
    const key = "dokuel_mp_snap_room-dom-events";
    expect(localStorage.getItem(key)).toBeNull();

    act(() => {
      setTabHidden(true);
    });
    expect(localStorage.getItem(key)).not.toBeNull();

    localStorage.removeItem(key);
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });

    expect(localStorage.getItem(key)).not.toBeNull();
  });
});
