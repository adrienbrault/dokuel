import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import {
  claimWinner,
  createRoomFromDoc,
  getHostId,
  getOpponentProgress,
  getPlayers,
  getRoomState,
  getRoomStatus,
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
  describe("joinRoom", () => {
    it("sets first player as host", () => {
      const room = createTestRoom();
      joinRoom(room, "player1", "Alice");

      expect(room.doc.getMap("room").get("hostId")).toBe("player1");
    });

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

    it("does not overwrite host when second player joins", () => {
      const room = createTestRoom();
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
      // it in a fresh tab with no IndexedDB, both peers run
      // createRoomFromDoc + joinRoom on their own Y.Doc before WebRTC
      // sync arrives. Under the old logic, both peers' joinRoom calls
      // see an empty hostId locally and claim host — the joiner's
      // concurrent write to hostId then wins via Yjs's last-writer-wins
      // tiebreak (higher clientID wins concurrent writes), stealing
      // host from the original creator. Force the joiner's clientID
      // higher than the host's so the race resolves deterministically
      // in favour of the wrong outcome under the old code.
      const hostDoc = new Y.Doc();
      hostDoc.clientID = 1;
      const joinerDoc = new Y.Doc();
      joinerDoc.clientID = 2;

      const hostRoom = createRoomFromDoc(hostDoc, "test-room");
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

      const claimed = claimWinner(room, "player1", "Alice");

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

      claimWinner(room, "player1", "Alice");
      const claimed = claimWinner(room, "player2", "Bob");

      expect(claimed).toBe(false);
      expect(room.doc.getMap("room").get("winnerId")).toBe("player1");
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

    it("returns null after createRoomFromDoc but before joinRoom", () => {
      const room = createTestRoom();
      // status is initialised by createRoomFromDoc, but there are no players —
      // a room state with no players is meaningless to the UI.
      expect(getRoomState(room)).toBeNull();
    });

    it("returns a full snapshot after joinRoom", () => {
      const room = createTestRoom();
      joinRoom(room, "player1", "Alice");

      const state = getRoomState(room);
      expect(state).not.toBeNull();
      expect(state!.status).toBe("lobby");
      expect(state!.hostId).toBe("player1");
      expect(state!.difficulty).toBe("medium");
      expect(state!.assistLevel).toBe("standard");
      expect(state!.players).toHaveLength(1);
      expect(state!.puzzle).toBeNull();
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
      expect(state.gameNumber).toBe(1);
    });

    it("reflects claimWinner with both id and name", () => {
      const room = createTestRoom();
      joinRoom(room, "player1", "Alice");
      joinRoom(room, "player2", "Bob");
      startGame(room, "medium");
      claimWinner(room, "player1", "Alice");

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

    it("returns the first joined player's id", () => {
      const room = createTestRoom();
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
});
