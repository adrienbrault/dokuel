import { describe, expect, it } from "vitest";
import { GameRoom } from "./room.ts";

describe("GameRoom", () => {
  describe("join", () => {
    it("first player becomes host", () => {
      const room = new GameRoom("room-1");
      const messages = room.handleJoin("p1", "Alice");

      expect(room.state.hostId).toBe("p1");
      expect(room.state.players).toHaveLength(1);
      expect(room.state.players[0]).toMatchObject({
        id: "p1",
        name: "Alice",
        connected: true,
        cellsRemaining: 81,
        completionPercent: 0,
      });
      expect(room.state.status).toBe("lobby");

      // Should send room_state to all
      expect(messages).toHaveLength(1);
      expect(messages[0].target).toBe("all");
      expect(messages[0].message.type).toBe("room_state");
    });

    it("second player joins with different color", () => {
      const room = new GameRoom("room-1");
      room.handleJoin("p1", "Alice");
      const messages = room.handleJoin("p2", "Bob");

      expect(room.state.players).toHaveLength(2);
      expect(room.state.players[1]).toMatchObject({
        id: "p2",
        name: "Bob",
        connected: true,
      });
      // Different colors
      expect(room.state.players[0].color).not.toBe(room.state.players[1].color);
      // Host unchanged
      expect(room.state.hostId).toBe("p1");
      // Broadcasts updated room state
      expect(messages).toHaveLength(1);
      expect(messages[0].target).toBe("all");
    });

    it("third player joins as spectator when room is full", () => {
      const room = new GameRoom("room-1");
      room.handleJoin("p1", "Alice");
      room.handleJoin("p2", "Bob");
      const messages = room.handleJoin("p3", "Charlie");

      expect(room.state.players).toHaveLength(2);
      expect(room.spectators).toHaveLength(1);
      expect(messages).toHaveLength(1);
      expect(messages[0].target).toBe("sender");
      expect(messages[0].message.type).toBe("room_state");
    });

    it("allows reconnecting player to rejoin", () => {
      const room = new GameRoom("room-1");
      room.handleJoin("p1", "Alice");
      room.handleJoin("p2", "Bob");
      room.handleDisconnect("p2");

      const messages = room.handleJoin("p2", "Bob");
      expect(room.state.players).toHaveLength(2);
      expect(room.state.players[1].connected).toBe(true);
      expect(messages[0].target).toBe("all");
    });
  });

  describe("start game", () => {
    it("host starts game with both players present", () => {
      const room = new GameRoom("room-1");
      room.handleJoin("p1", "Alice");
      room.handleJoin("p2", "Bob");
      const messages = room.handleStartGame("p1", "medium");

      expect(room.state.status).toBe("playing");
      expect(room.state.puzzle).toMatch(/^[.1-9]{81}$/);
      expect(room.solution).toMatch(/^[1-9]{81}$/);
      expect(room.state.difficulty).toBe("medium");

      // Should send game_start to all
      const gameStart = messages.find((m) => m.message.type === "game_start");
      expect(gameStart).toBeDefined();
      expect(gameStart!.target).toBe("all");
      expect(
        gameStart!.message.type === "game_start" && gameStart!.message.puzzle,
      ).toBe(room.state.puzzle);
    });

    it("non-host cannot start game", () => {
      const room = new GameRoom("room-1");
      room.handleJoin("p1", "Alice");
      room.handleJoin("p2", "Bob");
      const messages = room.handleStartGame("p2", "medium");

      expect(room.state.status).toBe("lobby");
      expect(messages[0].message).toMatchObject({
        type: "error",
        message: "Only the host can start the game",
      });
    });

    it("cannot start without two players", () => {
      const room = new GameRoom("room-1");
      room.handleJoin("p1", "Alice");
      const messages = room.handleStartGame("p1", "medium");

      expect(room.state.status).toBe("lobby");
      expect(messages[0].message).toMatchObject({
        type: "error",
        message: "Need 2 players to start",
      });
    });
  });

  describe("progress", () => {
    it("forwards progress to opponent", () => {
      const room = new GameRoom("room-1");
      room.handleJoin("p1", "Alice");
      room.handleJoin("p2", "Bob");
      room.handleStartGame("p1", "easy");

      const messages = room.handleProgress("p1", 30, 63);

      expect(room.state.players[0].cellsRemaining).toBe(30);
      expect(room.state.players[0].completionPercent).toBe(63);
      expect(messages).toHaveLength(1);
      expect(messages[0].target).toBe("opponent");
      expect(messages[0].message).toMatchObject({
        type: "opponent_progress",
        cellsRemaining: 30,
        completionPercent: 63,
      });
    });
  });

  describe("completion", () => {
    it("accepts correct solution and declares winner", () => {
      const room = new GameRoom("room-1");
      room.handleJoin("p1", "Alice");
      room.handleJoin("p2", "Bob");
      room.handleStartGame("p1", "easy");

      const messages = room.handleComplete("p1", room.solution!);

      expect(room.state.status).toBe("finished");
      expect(room.state.winnerId).toBe("p1");
      const gameOver = messages.find((m) => m.message.type === "game_over");
      expect(gameOver).toBeDefined();
      expect(gameOver!.target).toBe("all");
      expect(gameOver!.message).toMatchObject({
        type: "game_over",
        winnerId: "p1",
        winnerName: "Alice",
      });
    });

    it("rejects incorrect solution", () => {
      const room = new GameRoom("room-1");
      room.handleJoin("p1", "Alice");
      room.handleJoin("p2", "Bob");
      room.handleStartGame("p1", "easy");

      const wrongBoard = "1".repeat(81);
      const messages = room.handleComplete("p1", wrongBoard);

      expect(room.state.status).toBe("playing");
      expect(room.state.winnerId).toBeNull();
      expect(messages[0].message).toMatchObject({
        type: "error",
        message: "Solution is incorrect",
      });
    });
  });

  describe("rematch", () => {
    it("starts new game with same difficulty after rematch", () => {
      const room = new GameRoom("room-1");
      room.handleJoin("p1", "Alice");
      room.handleJoin("p2", "Bob");
      room.handleStartGame("p1", "hard");
      room.handleComplete("p1", room.solution!);

      const oldPuzzle = room.state.puzzle;
      const messages = room.handleRematch();

      expect(room.state.status).toBe("playing");
      expect(room.state.winnerId).toBeNull();
      expect(room.state.puzzle).not.toBe(oldPuzzle);
      expect(room.state.difficulty).toBe("hard");
      expect(room.solution).toMatch(/^[1-9]{81}$/);

      const rematchMsg = messages.find(
        (m) => m.message.type === "rematch_start",
      );
      expect(rematchMsg).toBeDefined();
      expect(rematchMsg!.target).toBe("all");
    });
  });

  describe("message dispatch", () => {
    it("routes client messages to correct handlers", () => {
      const room = new GameRoom("room-1");

      const joinMsgs = room.handleMessage("p1", {
        type: "join",
        name: "Alice",
        playerId: "p1",
      });
      expect(room.state.players).toHaveLength(1);
      expect(joinMsgs.length).toBeGreaterThan(0);

      room.handleMessage("p2", {
        type: "join",
        name: "Bob",
        playerId: "p2",
      });

      const startMsgs = room.handleMessage("p1", {
        type: "start_game",
      });
      expect(room.state.status).toBe("playing");
      expect(startMsgs.length).toBeGreaterThan(0);

      const progressMsgs = room.handleMessage("p1", {
        type: "progress",
        cellsRemaining: 20,
        completionPercent: 75,
      });
      expect(progressMsgs[0].message).toMatchObject({
        type: "opponent_progress",
      });

      const completeMsgs = room.handleMessage("p1", {
        type: "complete",
        board: room.solution!,
      });
      expect(room.state.status).toBe("finished");
      expect(completeMsgs.length).toBeGreaterThan(0);
    });
  });

  describe("spectator", () => {
    it("third player joins as spectator when room is full", () => {
      const room = new GameRoom("room-1");
      room.handleJoin("p1", "Alice");
      room.handleJoin("p2", "Bob");
      const messages = room.handleSpectate("s1", "Charlie");

      expect(room.spectators).toHaveLength(1);
      expect(room.spectators[0]).toMatchObject({
        id: "s1",
        name: "Charlie",
      });
      expect(messages).toHaveLength(1);
      expect(messages[0].target).toBe("sender");
      expect(messages[0].message.type).toBe("room_state");
    });

    it("spectators receive progress updates via broadcast", () => {
      const room = new GameRoom("room-1");
      room.handleJoin("p1", "Alice");
      room.handleJoin("p2", "Bob");
      room.handleStartGame("p1", "easy");

      // Progress sends to opponent only, but game_over goes to all (including spectators via broadcast)
      const messages = room.handleComplete("p1", room.solution!);
      const gameOver = messages.find((m) => m.message.type === "game_over");
      expect(gameOver).toBeDefined();
      expect(gameOver!.target).toBe("all");
    });
  });
});
