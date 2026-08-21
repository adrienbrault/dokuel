import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import type { Difficulty } from "../lib/types.ts";
import type { MpSnapshot } from "./mp-snapshot.ts";
import {
  createRoomFromDoc,
  getHostId,
  hydrateRoomFromSnapshot,
  initializeRoom,
  joinRoom,
  leaveRoom,
  observeRoomChanges,
  type P2PRoom,
  readPlayers,
  readRoom,
  setDifficulty,
  updateProgress,
  writeClaim,
  writeGame,
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

const PUZZLE = "1".padEnd(81, ".");
const SOLUTION = "1".repeat(81);

/**
 * Land a game in the doc. Which board and which number is the Room's
 * decision, not this module's, so the fixture names them outright
 * rather than generating one.
 */
function writeTestGame(room: P2PRoom, difficulty: Difficulty = "medium"): void {
  writeGame(room, {
    puzzle: PUZZLE,
    solution: SOLUTION,
    difficulty,
    gameNumber: 1,
    cellsRemaining: 80,
  });
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

      const players1 = readPlayers(room1);
      const players2 = readPlayers(room2);
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

  describe("readRoom", () => {
    it("returns null before anything has been written", () => {
      const room: P2PRoom = { doc: new Y.Doc(), roomId: "empty" };
      expect(readRoom(room)).toBeNull();
    });

    it("returns null after createRoomFromDoc but before initializeRoom", () => {
      const room = createTestRoom();
      // createRoomFromDoc does not write anything to the doc — status
      // is set by initializeRoom (creator) or by Yjs sync (joiner).
      expect(readRoom(room)).toBeNull();
    });

    it("returns every field the creator seeded", () => {
      const room = createTestRoom();
      initializeRoom(room, "player1", "medium");

      const fields = readRoom(room)!;
      expect(fields.status).toBe("lobby");
      expect(fields.hostId).toBe("player1");
      expect(fields.difficulty).toBe("medium");
      expect(fields.assistLevel).toBe("standard");
      expect(fields.puzzle).toBeNull();
      expect(fields.solution).toBeNull();
      expect(fields.winnerId).toBeNull();
      expect(fields.winnerName).toBeNull();
      expect(fields.gameNumber).toBe(0);
    });

    it("reflects a recorded game", () => {
      const room = createTestRoom();
      joinRoom(room, "player1", "Alice");
      joinRoom(room, "player2", "Bob");
      writeTestGame(room, "hard");

      const state = readRoom(room)!;
      expect(state.status).toBe("playing");
      expect(state.difficulty).toBe("hard");
      expect(state.puzzle).toBe(PUZZLE);
      expect(state.solution).toBe(SOLUTION);
      expect(state.gameNumber).toBe(1);
    });

    it("reflects a recorded win claim with both id and name", () => {
      const room = createTestRoom();
      joinRoom(room, "player1", "Alice");
      joinRoom(room, "player2", "Bob");
      writeTestGame(room);
      writeClaim(room, "player1", "Alice", SOLUTION);

      const state = readRoom(room)!;
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

      const fields = readRoom(room);
      expect(fields).not.toBeNull();
      expect(fields?.status).toBe("playing");
      expect(fields?.gameNumber).toBe(2);
      expect(fields?.puzzle).toBe(snap.puzzle);
      expect(fields?.solution).toBe(snap.solution);
      expect(fields?.difficulty).toBe("hard");
      expect(fields?.hostId).toBe("p1");
      const players = readPlayers(room);
      expect(players).toHaveLength(2);
      expect(players.find((p) => p.id === "p1")?.cellsRemaining).toBe(40);
      expect(players.find((p) => p.id === "p2")?.completionPercent).toBe(63);
    });

    it("does not clobber existing keys", () => {
      const room = createTestRoom();
      initializeRoom(room, "p1", "easy");
      joinRoom(room, "p1", "Alice");
      joinRoom(room, "p2", "Bob");
      writeTestGame(room, "easy");
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
      const players = readPlayers(room);
      expect(players).toHaveLength(2);
      expect(players.find((p) => p.id === "p2")?.cellsRemaining).toBe(30);
    });
  });

  describe("leaveRoom", () => {
    it("removes the player's entry from the room", () => {
      const room = createTestRoom();
      joinRoom(room, "p1", "Alice");
      joinRoom(room, "p2", "Bob");

      leaveRoom(room, "p2");

      expect(readPlayers(room)).toHaveLength(1);
      expect(readPlayers(room)[0]!.id).toBe("p1");
    });

    it("is a no-op for a player not in the room", () => {
      const room = createTestRoom();
      joinRoom(room, "p1", "Alice");

      leaveRoom(room, "ghost");

      expect(readPlayers(room)).toHaveLength(1);
    });

    it("resolves a concurrent-join overflow back to a startable room", () => {
      // Two joiners race the host's 2-player cap before syncing: the
      // merge leaves 3 entries. The deterministic overflow player must
      // be able to remove itself, otherwise the remaining two are stuck
      // in a lobby whose Start never enables.
      const docA = new Y.Doc();
      const docB = new Y.Doc();
      const roomA = createRoomFromDoc(docA, "race");
      const roomB = createRoomFromDoc(docB, "race");
      joinRoom(roomA, "host", "Host");
      Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));

      joinRoom(roomA, "j1", "One");
      joinRoom(roomB, "j2", "Two");
      const updateA = Y.encodeStateAsUpdate(docA);
      const updateB = Y.encodeStateAsUpdate(docB);
      Y.applyUpdate(docB, updateA);
      Y.applyUpdate(docA, updateB);
      expect(readPlayers(roomA)).toHaveLength(3);

      const overflowId = readPlayers(roomA)[2]!.id;
      leaveRoom(roomA, overflowId);
      Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));

      expect(readPlayers(roomA)).toHaveLength(2);
      expect(readPlayers(roomB)).toHaveLength(2);
      expect(readPlayers(roomB).some((p) => p.id === overflowId)).toBe(false);
    });
  });
});
