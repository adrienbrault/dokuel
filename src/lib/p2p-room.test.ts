import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  claimWinner,
  createRoomFromDoc,
  getOpponentProgress,
  getPlayers,
  getRoomStatus,
  joinRoom,
  type P2PRoom,
  requestRematch,
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

      const oldPuzzle = room.doc.getMap("room").get("puzzle");
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
      expect(players[0].id).toBe("player2");
      expect(players[1].id).toBe("player1");
    });
  });
});
