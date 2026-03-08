import { beforeEach, describe, expect, it } from "vitest";
import { addFriend, getFriends, isFriend, removeFriend } from "./friends.ts";

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
      expect(friends[0].playerId).toBe("abc12345");
      expect(friends[0].name).toBe("Swift Panda");
      expect(friends[0].addedAt).toBeTruthy();
    });

    it("updates name and addedAt for existing friend", () => {
      addFriend("abc12345", "Swift Panda");
      const before = getFriends()[0].addedAt;
      addFriend("abc12345", "Bold Lion");
      const friends = getFriends();
      expect(friends).toHaveLength(1);
      expect(friends[0].name).toBe("Bold Lion");
      expect(friends[0].addedAt).not.toBe(before);
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
      expect(friends[0].playerId).toBe("xyz67890");
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
});
