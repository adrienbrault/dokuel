import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import type { Friend } from "../lib/friends.ts";
import { usePresence } from "./usePresence.ts";

// Shared state for mock — declared before vi.mock so hoisting works
const mockState = {
  instances: [] as Array<{
    disconnect: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  }>,
  awareness: {
    listeners: new Map<string, Set<(...args: unknown[]) => void>>(),
    states: new Map<number, Record<string, unknown>>(),
    localState: {} as Record<string, unknown>,
    clientID: 1,
  },
  capturedDoc: null as Y.Doc | null,
};

vi.mock("y-webrtc", () => {
  return {
    WebrtcProvider: class MockProvider {
      awareness: {
        setLocalStateField: (field: string, value: unknown) => void;
        getStates: () => Map<number, Record<string, unknown>>;
        on: (event: string, fn: (...args: unknown[]) => void) => void;
        off: (event: string, fn: (...args: unknown[]) => void) => void;
      };
      connected = true;
      disconnect = vi.fn();
      destroy = vi.fn();
      on = vi.fn();
      off = vi.fn();
      constructor(_room: string, doc: Y.Doc) {
        mockState.capturedDoc = doc;
        mockState.awareness.clientID = doc.clientID;
        this.awareness = {
          setLocalStateField(field: string, value: unknown) {
            mockState.awareness.localState[field] = value;
          },
          getStates() {
            return mockState.awareness.states;
          },
          on(event: string, fn: (...args: unknown[]) => void) {
            if (!mockState.awareness.listeners.has(event))
              mockState.awareness.listeners.set(event, new Set());
            mockState.awareness.listeners.get(event)!.add(fn);
          },
          off(event: string, fn: (...args: unknown[]) => void) {
            mockState.awareness.listeners.get(event)?.delete(fn);
          },
        };
        mockState.instances.push(this);
      }
    },
  };
});

function emitAwarenessChange() {
  for (const fn of mockState.awareness.listeners.get("change") ?? []) {
    fn();
  }
}

function makeFriend(playerId: string, name: string): Friend {
  return { playerId, name, addedAt: new Date().toISOString() };
}

describe("usePresence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.instances = [];
    mockState.awareness.listeners.clear();
    mockState.awareness.states.clear();
    mockState.awareness.localState = {};
    mockState.capturedDoc = null;
  });

  it("does not connect when enabled is false", () => {
    renderHook(() =>
      usePresence({
        playerId: "me123",
        playerName: "Swift Panda",
        friends: [],
        enabled: false,
      }),
    );

    expect(mockState.instances).toHaveLength(0);
  });

  it("connects to presence room when enabled is true", () => {
    const friends = [makeFriend("friend1", "Bold Lion")];
    renderHook(() =>
      usePresence({
        playerId: "me123",
        playerName: "Swift Panda",
        friends,
        enabled: true,
      }),
    );

    expect(mockState.instances).toHaveLength(1);
    expect(mockState.capturedDoc).toBeInstanceOf(Y.Doc);
  });

  it("sets awareness with player identity", () => {
    const friends = [makeFriend("friend1", "Bold Lion")];
    renderHook(() =>
      usePresence({
        playerId: "me123",
        playerName: "Swift Panda",
        friends,
        enabled: true,
      }),
    );

    expect(mockState.awareness.localState).toEqual({
      user: { id: "me123", name: "Swift Panda" },
    });
  });

  it("returns online friend IDs from awareness", () => {
    const friends = [
      makeFriend("friend1", "Bold Lion"),
      makeFriend("friend2", "Clever Fox"),
    ];

    const { result } = renderHook(() =>
      usePresence({
        playerId: "me123",
        playerName: "Swift Panda",
        friends,
        enabled: true,
      }),
    );

    act(() => {
      mockState.awareness.states.set(99, { user: { id: "friend1" } });
      emitAwarenessChange();
    });

    expect(result.current.onlineFriendIds.has("friend1")).toBe(true);
    expect(result.current.onlineFriendIds.has("friend2")).toBe(false);
  });

  it("filters out non-friends from online list", () => {
    const friends = [makeFriend("friend1", "Bold Lion")];

    const { result } = renderHook(() =>
      usePresence({
        playerId: "me123",
        playerName: "Swift Panda",
        friends,
        enabled: true,
      }),
    );

    act(() => {
      mockState.awareness.states.set(99, { user: { id: "stranger123" } });
      emitAwarenessChange();
    });

    expect(result.current.onlineFriendIds.size).toBe(0);
  });

  it("returns pending invites targeting this player", () => {
    const friends = [makeFriend("friend1", "Bold Lion")];

    const { result } = renderHook(() =>
      usePresence({
        playerId: "me123",
        playerName: "Swift Panda",
        friends,
        enabled: true,
      }),
    );

    act(() => {
      mockState.capturedDoc!.getMap("invites").set("me123", {
        roomId: "test-room",
        fromId: "friend1",
        fromName: "Bold Lion",
        difficulty: "medium",
        timestamp: 1000,
      });
    });

    expect(result.current.pendingInvites).toHaveLength(1);
    expect(result.current.pendingInvites[0].roomId).toBe("test-room");
    expect(result.current.pendingInvites[0].fromName).toBe("Bold Lion");
  });

  it("sendInvite writes to Yjs invites map", () => {
    const friends = [makeFriend("friend1", "Bold Lion")];

    const { result } = renderHook(() =>
      usePresence({
        playerId: "me123",
        playerName: "Swift Panda",
        friends,
        enabled: true,
      }),
    );

    act(() => {
      result.current.sendInvite("friend1", "game-room-42", "hard");
    });

    const invite = mockState
      .capturedDoc!.getMap("invites")
      .get("friend1") as Record<string, unknown>;
    expect(invite.roomId).toBe("game-room-42");
    expect(invite.fromId).toBe("me123");
    expect(invite.fromName).toBe("Swift Panda");
    expect(invite.difficulty).toBe("hard");
  });

  it("clearInvite removes invite from map", () => {
    const friends = [makeFriend("friend1", "Bold Lion")];

    const { result } = renderHook(() =>
      usePresence({
        playerId: "me123",
        playerName: "Swift Panda",
        friends,
        enabled: true,
      }),
    );

    act(() => {
      mockState.capturedDoc!.getMap("invites").set("me123", {
        roomId: "test-room",
        fromId: "friend1",
        fromName: "Bold Lion",
        difficulty: "medium",
        timestamp: 1000,
      });
    });

    act(() => {
      result.current.clearInvite("friend1");
    });

    expect(
      mockState.capturedDoc!.getMap("invites").get("me123"),
    ).toBeUndefined();
    expect(result.current.pendingInvites).toHaveLength(0);
  });

  it("returns empty defaults when not enabled", () => {
    const { result } = renderHook(() =>
      usePresence({
        playerId: "me123",
        playerName: "Swift Panda",
        friends: [],
        enabled: false,
      }),
    );

    expect(result.current.onlineFriendIds.size).toBe(0);
    expect(result.current.pendingInvites).toHaveLength(0);
  });
});
