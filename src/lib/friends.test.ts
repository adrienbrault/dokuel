import { beforeEach, describe, expect, it, jest } from "bun:test";
import {
  addFriend,
  clearPendingInvite,
  clearStalePendingInvites,
  getFriends,
  getPendingInvites,
  isFriend,
  removeFriend,
  storePendingInvite,
} from "./friends.ts";

describe("friends", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("getFriends", () => {
    it("returns empty array when no friends saved", () => {
      expect(getFriends()).toEqual([]);
    });

    it("returns default on invalid JSON", () => {
      localStorage.setItem("sudoku_friends", "not json");
      expect(getFriends()).toEqual([]);
    });
  });

  describe("addFriend", () => {
    it("saves a friend and getFriends returns it", () => {
      addFriend("abc12345", "Swift Panda");
      const friends = getFriends();
      expect(friends).toHaveLength(1);
      expect(friends[0]!.playerId).toBe("abc12345");
      expect(friends[0]!.name).toBe("Swift Panda");
      expect(friends[0]!.addedAt).toBeTruthy();
    });

    it("updates name and addedAt for existing friend", () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-03-01T10:00:00Z"));
      addFriend("abc12345", "Swift Panda");
      const before = getFriends()[0]!.addedAt;

      jest.setSystemTime(new Date("2026-03-02T10:00:00Z"));
      addFriend("abc12345", "Bold Lion");
      const friends = getFriends();
      expect(friends).toHaveLength(1);
      expect(friends[0]!.name).toBe("Bold Lion");
      expect(friends[0]!.addedAt).not.toBe(before);
      jest.useRealTimers();
    });

    it("caps at 20 friends, dropping oldest", () => {
      for (let i = 0; i < 21; i++) {
        addFriend(`player${i}`, `Player ${i}`);
      }
      const friends = getFriends();
      expect(friends).toHaveLength(20);
      expect(friends.find((f) => f.playerId === "player0")).toBeUndefined();
      expect(friends.find((f) => f.playerId === "player20")).toBeDefined();
    });
  });

  describe("removeFriend", () => {
    it("removes a friend by playerId", () => {
      addFriend("abc12345", "Swift Panda");
      addFriend("xyz67890", "Bold Lion");
      removeFriend("abc12345");
      const friends = getFriends();
      expect(friends).toHaveLength(1);
      expect(friends[0]!.playerId).toBe("xyz67890");
    });

    it("is a no-op for unknown playerId", () => {
      addFriend("abc12345", "Swift Panda");
      removeFriend("unknown");
      expect(getFriends()).toHaveLength(1);
    });
  });

  describe("isFriend", () => {
    it("returns true for saved friend", () => {
      addFriend("abc12345", "Swift Panda");
      expect(isFriend("abc12345")).toBe(true);
    });

    it("returns false for unknown playerId", () => {
      expect(isFriend("abc12345")).toBe(false);
    });
  });

  describe("pending invites", () => {
    it("returns empty array when no pending invites", () => {
      expect(getPendingInvites()).toEqual([]);
    });

    it("stores and retrieves a pending invite", () => {
      storePendingInvite({
        targetPlayerId: "friend1",
        roomId: "room-abc",
        fromId: "me123",
        fromName: "Swift Panda",
        difficulty: "medium",
        timestamp: 1000,
      });
      const invites = getPendingInvites();
      expect(invites).toHaveLength(1);
      expect(invites[0]!.targetPlayerId).toBe("friend1");
      expect(invites[0]!.roomId).toBe("room-abc");
    });

    it("overwrites invite for the same target player", () => {
      storePendingInvite({
        targetPlayerId: "friend1",
        roomId: "room-1",
        fromId: "me123",
        fromName: "Swift Panda",
        difficulty: "medium",
        timestamp: 1000,
      });
      storePendingInvite({
        targetPlayerId: "friend1",
        roomId: "room-2",
        fromId: "me123",
        fromName: "Swift Panda",
        difficulty: "hard",
        timestamp: 2000,
      });
      const invites = getPendingInvites();
      expect(invites).toHaveLength(1);
      expect(invites[0]!.roomId).toBe("room-2");
    });

    it("clears a specific pending invite", () => {
      storePendingInvite({
        targetPlayerId: "friend1",
        roomId: "room-1",
        fromId: "me123",
        fromName: "Swift Panda",
        difficulty: "medium",
        timestamp: 1000,
      });
      storePendingInvite({
        targetPlayerId: "friend2",
        roomId: "room-2",
        fromId: "me123",
        fromName: "Swift Panda",
        difficulty: "hard",
        timestamp: 2000,
      });
      clearPendingInvite("friend1");
      const invites = getPendingInvites();
      expect(invites).toHaveLength(1);
      expect(invites[0]!.targetPlayerId).toBe("friend2");
    });

    it("removes stale invites older than maxAge", () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-03-01T10:00:00Z"));
      storePendingInvite({
        targetPlayerId: "friend1",
        roomId: "room-old",
        fromId: "me123",
        fromName: "Swift Panda",
        difficulty: "medium",
        timestamp: Date.now(),
      });

      jest.setSystemTime(new Date("2026-03-01T11:00:00Z"));
      storePendingInvite({
        targetPlayerId: "friend2",
        roomId: "room-new",
        fromId: "me123",
        fromName: "Swift Panda",
        difficulty: "hard",
        timestamp: Date.now(),
      });

      // 31 minutes later — first invite is stale (30 min max)
      jest.setSystemTime(new Date("2026-03-01T10:31:00Z"));
      clearStalePendingInvites(30 * 60 * 1000);

      const invites = getPendingInvites();
      expect(invites).toHaveLength(1);
      expect(invites[0]!.targetPlayerId).toBe("friend2");
      jest.useRealTimers();
    });
  });
});
