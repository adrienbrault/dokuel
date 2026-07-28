import { describe, expect, it, vi } from "vitest";
import { Awareness, removeAwarenessStates } from "y-protocols/awareness";
import * as Y from "yjs";
import type { MpSnapshot } from "./mp-snapshot.ts";
import {
  announcePresence,
  claimWinner,
  createRoomFromDoc,
  getHostId,
  getOpponentProgress,
  getPlayers,
  getRoomState,
  getRoomStatus,
  hydrateRoomFromSnapshot,
  initializeRoom,
  joinRoom,
  observeRoomChanges,
  type P2PRoom,
  requestRematch,
  setDifficulty,
  startGame,
  updateProgress,
} from "./p2p-room.ts";

function createLinkedDocs(): [Y.Doc, Y.Doc] {
  const doc1 = new Y.Doc();
  const doc2 = new Y.Doc();
  doc1.on("update", (update: Uint8Array) => Y.applyUpdate(doc2, update));
  doc2.on("update", (update: Uint8Array) => Y.applyUpdate(doc1, update));
  return [doc1, doc2];
}

function createTestRoom(doc?: Y.Doc): P2PRoom {
  return createRoomFromDoc(doc ?? new Y.Doc(), "test-room");
}

describe("p2p-room", () => {
  describe("initializeRoom", () => {
    it("claims host for the creator", () => {
      const room = createTestRoom();
      initializeRoom(room, "player1", "medium");

      expect(room.doc.getMap("room").get("hostId")).toBe("player1");
    });

    it("is a no-op when the room is already initialized", () => {
      const room = createTestRoom();
      initializeRoom(room, "player1", "medium");
      initializeRoom(room, "player2", "hard");

      const roomMap = room.doc.getMap("room");
      expect(roomMap.get("hostId")).toBe("player1");
      expect(roomMap.get("difficulty")).toBe("medium");
    });
  });

  describe("joinRoom", () => {
    it("assigns first player color blue", () => {
      const room = createTestRoom();
      joinRoom(room, "player1", "Alice");

      const players = room.doc.getMap("players");
      const p1 = players.get("player1") as Y.Map<unknown>;
      expect(p1.get("color")).toBe("#3B82F6");
    });

    it("assigns second player a different color", () => {
      const room = createTestRoom();
      joinRoom(room, "player1", "Alice");
      joinRoom(room, "player2", "Bob");

      const players = room.doc.getMap("players");
      const p1 = players.get("player1") as Y.Map<unknown>;
      const p2 = players.get("player2") as Y.Map<unknown>;
      expect(p1.get("color")).not.toBe(p2.get("color"));
    });

    it("does not add a third player to a full room", () => {
      // Spec: 1v1 rooms hold two players; a third joiner gets the
      // "Game is full" screen. Without the cap the Start button's
      // players.length === 2 check could never pass again.
      const room = createTestRoom();
      joinRoom(room, "player1", "Alice");
      joinRoom(room, "player2", "Bob");
      joinRoom(room, "player3", "Carol");

      expect(getPlayers(room)).toHaveLength(2);
      expect(room.doc.getMap("players").has("player3")).toBe(false);
    });

    it("still recognizes an already-joined player when the room is full", () => {
      const room = createTestRoom();
      joinRoom(room, "player1", "Alice");
      joinRoom(room, "player2", "Bob");
      // Re-join (e.g. reconnect) must stay a no-op, not be treated as
      // a third player.
      joinRoom(room, "player1", "Alice");

      expect(getPlayers(room)).toHaveLength(2);
    });

    it("does not claim host on join", () => {
      // Host is claimed only by initializeRoom (creator-only). joinRoom
      // never writes hostId — see the deterministic race test below
      // for why this matters.
      const room = createTestRoom();
      initializeRoom(room, "player1", "medium");
      joinRoom(room, "player1", "Alice");
      joinRoom(room, "player2", "Bob");

      expect(room.doc.getMap("room").get("hostId")).toBe("player1");
    });

    it("initializes player with zero progress", () => {
      const room = createTestRoom();
      joinRoom(room, "player1", "Alice");

      const players = room.doc.getMap("players");
      const p1 = players.get("player1") as Y.Map<unknown>;
      expect(p1.get("cellsRemaining")).toBe(81);
      expect(p1.get("completionPercent")).toBe(0);
    });

    it("is a no-op for an already joined player", () => {
      const room = createTestRoom();
      joinRoom(room, "player1", "Alice");
      joinRoom(room, "player1", "Alice");

      const players = room.doc.getMap("players");
      expect(players.toJSON()).toHaveProperty("player1");
      expect(Object.keys(players.toJSON())).toHaveLength(1);
    });

    it("syncs across linked docs", () => {
      const [doc1, doc2] = createLinkedDocs();
      const room1 = createRoomFromDoc(doc1, "test-room");
      const room2 = createRoomFromDoc(doc2, "test-room");

      joinRoom(room1, "player1", "Alice");
      joinRoom(room2, "player2", "Bob");

      const players1 = getPlayers(room1);
      const players2 = getPlayers(room2);
      expect(players1).toHaveLength(2);
      expect(players2).toHaveLength(2);
    });

    it("does not transfer host status when a joiner mounts before sync", () => {
      // Simulates the real-world race: host shares a link, joiner opens
      // it in a fresh tab with no IndexedDB, both peers mount their
      // own Y.Doc before WebRTC sync arrives. The creator calls
      // initializeRoom (came in with a chosen difficulty); the joiner
      // does not (came in via shared link, difficulty=null). Under
      // the previous logic both peers wrote hostId from joinRoom and
      // Yjs's last-writer-wins resolution handed host to the joiner
      // when its clientID was higher. ClientIDs are forced here so
      // that the race resolves deterministically in favour of the
      // wrong outcome under the old code.
      const hostDoc = new Y.Doc();
      hostDoc.clientID = 1;
      const joinerDoc = new Y.Doc();
      joinerDoc.clientID = 2;

      const hostRoom = createRoomFromDoc(hostDoc, "test-room");
      initializeRoom(hostRoom, "host", "medium");
      joinRoom(hostRoom, "host", "Alice");

      const joinerRoom = createRoomFromDoc(joinerDoc, "test-room");
      joinRoom(joinerRoom, "joiner", "Bob");

      Y.applyUpdate(joinerDoc, Y.encodeStateAsUpdate(hostDoc));
      Y.applyUpdate(hostDoc, Y.encodeStateAsUpdate(joinerDoc));

      expect(hostRoom.doc.getMap("room").get("hostId")).toBe("host");
      expect(joinerRoom.doc.getMap("room").get("hostId")).toBe("host");
    });
  });

  describe("startGame", () => {
    it("generates puzzle and solution", () => {
      const room = createTestRoom();
      joinRoom(room, "player1", "Alice");
      joinRoom(room, "player2", "Bob");

      startGame(room, "medium");

      const roomMap = room.doc.getMap("room");
      const puzzle = roomMap.get("puzzle") as string;
      const solution = roomMap.get("solution") as string;
      expect(puzzle).toHaveLength(81);
      expect(solution).toHaveLength(81);
      expect(puzzle).toContain(".");
      expect(solution).not.toContain(".");
    });

    it("sets status to playing", () => {
      const room = createTestRoom();
      joinRoom(room, "player1", "Alice");
      joinRoom(room, "player2", "Bob");

      startGame(room, "medium");

      expect(getRoomStatus(room)).toBe("playing");
    });

    it("sets difficulty", () => {
      const room = createTestRoom();
      joinRoom(room, "player1", "Alice");
      joinRoom(room, "player2", "Bob");

      startGame(room, "hard");

      expect(room.doc.getMap("room").get("difficulty")).toBe("hard");
    });

    it("resets player progress based on clue count", () => {
      const room = createTestRoom();
      joinRoom(room, "player1", "Alice");
      joinRoom(room, "player2", "Bob");

      startGame(room, "medium");

      const puzzle = room.doc.getMap("room").get("puzzle") as string;
      const clueCount = puzzle.split("").filter((c) => c !== ".").length;

      const players = room.doc.getMap("players");
      const p1 = players.get("player1") as Y.Map<unknown>;
      expect(p1.get("cellsRemaining")).toBe(81 - clueCount);
      expect(p1.get("completionPercent")).toBe(0);
    });

    it("increments gameNumber", () => {
      const room = createTestRoom();
      initializeRoom(room, "player1", "medium");
      joinRoom(room, "player1", "Alice");
      joinRoom(room, "player2", "Bob");

      expect(room.doc.getMap("room").get("gameNumber")).toBe(0);

      startGame(room, "medium");
      expect(room.doc.getMap("room").get("gameNumber")).toBe(1);
    });
  });

  describe("setDifficulty", () => {
    it("updates the room difficulty in the Yjs map", () => {
      const room = createTestRoom();
      joinRoom(room, "player1", "Alice");

      setDifficulty(room, "expert");

      expect(room.doc.getMap("room").get("difficulty")).toBe("expert");
    });
  });

  describe("updateProgress", () => {
    it("stores progress on the player entry", () => {
      const room = createTestRoom();
      joinRoom(room, "player1", "Alice");

      updateProgress(room, "player1", 20, 75);

      const players = room.doc.getMap("players");
      const p1 = players.get("player1") as Y.Map<unknown>;
      expect(p1.get("cellsRemaining")).toBe(20);
      expect(p1.get("completionPercent")).toBe(75);
    });
  });

  describe("getOpponentProgress", () => {
    it("returns opponent progress", () => {
      const room = createTestRoom();
      joinRoom(room, "player1", "Alice");
      joinRoom(room, "player2", "Bob");
      updateProgress(room, "player2", 15, 80);

      const progress = getOpponentProgress(room, "player1");
      expect(progress).toEqual({ cellsRemaining: 15, completionPercent: 80 });
    });

    it("returns null when no opponent", () => {
      const room = createTestRoom();
      joinRoom(room, "player1", "Alice");

      expect(getOpponentProgress(room, "player1")).toBeNull();
    });
  });

  describe("claimWinner", () => {
    it("sets winnerId when no current winner", () => {
      const room = createTestRoom();
      joinRoom(room, "player1", "Alice");
      joinRoom(room, "player2", "Bob");
      startGame(room, "medium");

      const solution = room.doc.getMap("room").get("solution") as string;
      const claimed = claimWinner(room, "player1", "Alice", solution);

      expect(claimed).toBe(true);
      const roomMap = room.doc.getMap("room");
      expect(roomMap.get("winnerId")).toBe("player1");
      expect(roomMap.get("winnerName")).toBe("Alice");
      expect(roomMap.get("status")).toBe("finished");
    });

    it("rejects when winner already claimed", () => {
      const room = createTestRoom();
      joinRoom(room, "player1", "Alice");
      joinRoom(room, "player2", "Bob");
      startGame(room, "medium");

      const solution = room.doc.getMap("room").get("solution") as string;
      claimWinner(room, "player1", "Alice", solution);
      const claimed = claimWinner(room, "player2", "Bob", solution);

      expect(claimed).toBe(false);
      expect(room.doc.getMap("room").get("winnerId")).toBe("player1");
    });

    it("lets a verified solved claim displace a forfeit claim", () => {
      // A forfeit only means anything while the "absent" player never
      // finishes. If they complete the real board, the forfeit was
      // premature or fabricated — the solve wins.
      const room = createTestRoom();
      joinRoom(room, "player1", "Alice");
      joinRoom(room, "player2", "Bob");
      startGame(room, "medium");

      const solution = room.doc.getMap("room").get("solution") as string;
      claimWinner(room, "player2", "Bob", null);
      const claimed = claimWinner(room, "player1", "Alice", solution);

      expect(claimed).toBe(true);
      expect(room.doc.getMap("room").get("winnerId")).toBe("player1");
    });

    it("does not let a wrong board displace a forfeit claim", () => {
      const room = createTestRoom();
      joinRoom(room, "player1", "Alice");
      joinRoom(room, "player2", "Bob");
      startGame(room, "medium");

      claimWinner(room, "player2", "Bob", null);
      const claimed = claimWinner(room, "player1", "Alice", "1".repeat(81));

      expect(claimed).toBe(false);
      expect(room.doc.getMap("room").get("winnerId")).toBe("player2");
    });
  });

  describe("requestRematch", () => {
    it("generates new puzzle and increments gameNumber", () => {
      const room = createTestRoom();
      joinRoom(room, "player1", "Alice");
      joinRoom(room, "player2", "Bob");
      startGame(room, "medium");

      const oldGameNumber = room.doc.getMap("room").get("gameNumber");

      requestRematch(room, "medium");

      const roomMap = room.doc.getMap("room");
      // gameNumber incremented
      expect(roomMap.get("gameNumber")).toBe((oldGameNumber as number) + 1);
      // new puzzle generated (could theoretically be same, but extremely unlikely)
      expect(roomMap.get("puzzle")).toHaveLength(81);
      expect(roomMap.get("status")).toBe("playing");
      expect(roomMap.get("winnerId")).toBeNull();
    });

    it("resets player progress", () => {
      const room = createTestRoom();
      joinRoom(room, "player1", "Alice");
      joinRoom(room, "player2", "Bob");
      startGame(room, "medium");

      updateProgress(room, "player1", 5, 95);
      requestRematch(room, "medium");

      const players = room.doc.getMap("players");
      const p1 = players.get("player1") as Y.Map<unknown>;
      expect(p1.get("completionPercent")).toBe(0);
    });
  });

  describe("getPlayers", () => {
    it("returns players sorted by join order", () => {
      const room = createTestRoom();
      joinRoom(room, "player2", "Bob");
      joinRoom(room, "player1", "Alice");

      const players = getPlayers(room);
      expect(players[0]!.id).toBe("player2");
      expect(players[1]!.id).toBe("player1");
    });
  });

  describe("getRoomState", () => {
    it("returns null before anyone joins (no status yet)", () => {
      const room: P2PRoom = { doc: new Y.Doc(), roomId: "empty" };
      expect(getRoomState(room)).toBeNull();
    });

    it("returns null after createRoomFromDoc but before initializeRoom", () => {
      const room = createTestRoom();
      // createRoomFromDoc does not write anything to the doc — status
      // is set by initializeRoom (creator) or by Yjs sync (joiner).
      expect(getRoomState(room)).toBeNull();
    });

    it("returns a full snapshot once the creator initializes and joins", () => {
      const room = createTestRoom();
      initializeRoom(room, "player1", "medium");
      joinRoom(room, "player1", "Alice");

      const state = getRoomState(room);
      expect(state).not.toBeNull();
      expect(state!.status).toBe("lobby");
      expect(state!.hostId).toBe("player1");
      expect(state!.difficulty).toBe("medium");
      expect(state!.assistLevel).toBe("standard");
      expect(state!.players).toHaveLength(1);
      expect(state!.puzzle).toBeNull();
      expect(state!.solution).toBeNull();
      expect(state!.winnerId).toBeNull();
      expect(state!.winnerName).toBeNull();
      expect(state!.gameNumber).toBe(0);
    });

    it("reflects startGame", () => {
      const room = createTestRoom();
      joinRoom(room, "player1", "Alice");
      joinRoom(room, "player2", "Bob");
      startGame(room, "hard");

      const state = getRoomState(room)!;
      expect(state.status).toBe("playing");
      expect(state.difficulty).toBe("hard");
      expect(state.puzzle).toHaveLength(81);
      expect(state.solution).toHaveLength(81);
      expect(state.solution).not.toContain(".");
      expect(state.gameNumber).toBe(1);
    });

    it("reflects claimWinner with both id and name", () => {
      const room = createTestRoom();
      joinRoom(room, "player1", "Alice");
      joinRoom(room, "player2", "Bob");
      startGame(room, "medium");
      const solution = room.doc.getMap("room").get("solution") as string;
      claimWinner(room, "player1", "Alice", solution);

      const state = getRoomState(room)!;
      expect(state.winnerId).toBe("player1");
      expect(state.winnerName).toBe("Alice");
      expect(state.status).toBe("finished");
    });
  });

  describe("getHostId", () => {
    it("returns the empty string before joinRoom", () => {
      const room = createTestRoom();
      expect(getHostId(room)).toBe("");
    });

    it("returns the host claimed by initializeRoom", () => {
      const room = createTestRoom();
      initializeRoom(room, "player1", "medium");
      joinRoom(room, "player1", "Alice");
      joinRoom(room, "player2", "Bob");
      expect(getHostId(room)).toBe("player1");
    });
  });

  describe("observeRoomChanges", () => {
    it("invokes the callback on room map changes", () => {
      const room = createTestRoom();
      const callback = vi.fn();
      observeRoomChanges(room, callback);

      setDifficulty(room, "hard");
      expect(callback).toHaveBeenCalled();
    });

    it("invokes the callback on players map changes", () => {
      const room = createTestRoom();
      const callback = vi.fn();
      observeRoomChanges(room, callback);

      joinRoom(room, "player1", "Alice");
      expect(callback).toHaveBeenCalled();
    });

    it("returns an unsubscribe function that stops both observers", () => {
      const room = createTestRoom();
      const callback = vi.fn();
      const unsubscribe = observeRoomChanges(room, callback);

      unsubscribe();
      setDifficulty(room, "hard");
      joinRoom(room, "player1", "Alice");
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("startGame with default difficulty", () => {
    it("uses the room's current difficulty when none is passed", () => {
      const room = createTestRoom();
      joinRoom(room, "player1", "Alice");
      joinRoom(room, "player2", "Bob");
      setDifficulty(room, "expert");

      startGame(room);

      expect(getRoomState(room)!.difficulty).toBe("expert");
    });
  });

  describe("requestRematch with default difficulty", () => {
    it("uses the room's current difficulty when none is passed", () => {
      const room = createTestRoom();
      joinRoom(room, "player1", "Alice");
      joinRoom(room, "player2", "Bob");
      setDifficulty(room, "hard");
      startGame(room);

      requestRematch(room);

      expect(getRoomState(room)!.difficulty).toBe("hard");
    });
  });

  describe("hydrateRoomFromSnapshot", () => {
    function makeSnap(overrides: Partial<MpSnapshot> = {}): MpSnapshot {
      return {
        gameNumber: 2,
        puzzle: ".".repeat(81),
        solution: "1".repeat(81),
        status: "playing",
        difficulty: "hard",
        assistLevel: "standard",
        hostId: "p1",
        players: [
          {
            id: "p1",
            name: "Alice",
            color: "#3B82F6",
            cellsRemaining: 40,
            completionPercent: 50,
          },
          {
            id: "p2",
            name: "Bob",
            color: "#EF4444",
            cellsRemaining: 30,
            completionPercent: 63,
          },
        ],
        winnerId: null,
        winnerName: null,
        savedAt: Date.now(),
        ...overrides,
      };
    }

    it("seeds an empty room with all snapshot fields", () => {
      const room: P2PRoom = { doc: new Y.Doc(), roomId: "test-room" };
      const snap = makeSnap();

      hydrateRoomFromSnapshot(room, snap);

      const state = getRoomState(room);
      expect(state).not.toBeNull();
      expect(state?.status).toBe("playing");
      expect(state?.gameNumber).toBe(2);
      expect(state?.puzzle).toBe(snap.puzzle);
      expect(state?.solution).toBe(snap.solution);
      expect(state?.difficulty).toBe("hard");
      expect(state?.hostId).toBe("p1");
      expect(state?.players).toHaveLength(2);
      expect(state?.players[0]?.cellsRemaining).toBe(40);
      expect(state?.players[1]?.completionPercent).toBe(63);
    });

    it("does not clobber existing keys", () => {
      const room = createTestRoom();
      initializeRoom(room, "p1", "easy");
      joinRoom(room, "p1", "Alice");
      joinRoom(room, "p2", "Bob");
      startGame(room);
      const beforePuzzle = room.doc.getMap("room").get("puzzle");
      const beforeGameNumber = room.doc.getMap("room").get("gameNumber");

      hydrateRoomFromSnapshot(
        room,
        makeSnap({
          puzzle: "1".padEnd(81, "."),
          gameNumber: 999,
          difficulty: "hard",
        }),
      );

      expect(room.doc.getMap("room").get("puzzle")).toBe(beforePuzzle);
      expect(room.doc.getMap("room").get("gameNumber")).toBe(beforeGameNumber);
      expect(room.doc.getMap("room").get("difficulty")).toBe("easy");
    });

    it("skips players already present in the room", () => {
      const room = createTestRoom();
      joinRoom(room, "p1", "Alice");
      const aliceMap = room.doc.getMap("players").get("p1") as Y.Map<unknown>;
      aliceMap.set("cellsRemaining", 5);

      hydrateRoomFromSnapshot(room, makeSnap());

      expect(aliceMap.get("cellsRemaining")).toBe(5);
      const players = getPlayers(room);
      expect(players).toHaveLength(2);
      expect(players.find((p) => p.id === "p2")?.cellsRemaining).toBe(30);
    });
  });

  describe("announcePresence", () => {
    it("publishes the player identity into awareness", () => {
      const doc = new Y.Doc();
      const awareness = new Awareness(doc);

      announcePresence(awareness, "player1", "Alice");

      expect(awareness.getLocalState()).toEqual({
        user: { id: "player1", name: "Alice" },
      });
      awareness.destroy();
    });

    it("restores presence after a disconnect cleared the local state", () => {
      const doc = new Y.Doc();
      const awareness = new Awareness(doc);
      // y-webrtc's Room.disconnect() removes the local client's
      // awareness entry, leaving local state null — the situation
      // after the tab was backgrounded long enough to drop WebRTC.
      removeAwarenessStates(awareness, [doc.clientID], "disconnect");
      expect(awareness.getLocalState()).toBeNull();

      announcePresence(awareness, "player1", "Alice");

      expect(awareness.getLocalState()).toEqual({
        user: { id: "player1", name: "Alice" },
      });
      awareness.destroy();
    });
  });
});
