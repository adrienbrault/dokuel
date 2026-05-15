import * as Y from "yjs";
import { generatePuzzle, solvePuzzle } from "./sudoku.ts";
import type { AssistLevel, Difficulty, Player } from "./types.ts";

const PLAYER_COLORS = [
  "#3B82F6", // blue
  "#EF4444", // red
  "#10B981", // emerald
  "#F59E0B", // amber
];

export type P2PRoom = {
  doc: Y.Doc;
  roomId: string;
};

export function createRoomFromDoc(doc: Y.Doc, roomId: string): P2PRoom {
  // No Yjs writes here. The creator publishes status/hostId/difficulty
  // via claimHost; joiners stay silent until sync arrives. Both peers
  // independently writing the same keys here would race during the
  // initial WebRTC sync (joiner's defaults could stomp the host's
  // pick — the cause of "the other person can change difficulty" and
  // "difficulty reset to medium").
  return { doc, roomId };
}

export function claimHost(room: P2PRoom, hostId: string): void {
  room.doc.transact(() => {
    const roomMap = room.doc.getMap("room");
    roomMap.set("hostId", hostId);
    if (!roomMap.has("status")) {
      roomMap.set("status", "lobby");
    }
    if (!roomMap.has("assistLevel")) {
      roomMap.set("assistLevel", "standard");
    }
  });
}

export function joinRoom(
  room: P2PRoom,
  playerId: string,
  playerName: string,
): void {
  const players = room.doc.getMap("players");
  if (players.has(playerId)) return;

  const joinOrder = players.size;

  room.doc.transact(() => {
    const playerMap = new Y.Map<unknown>();
    playerMap.set("name", playerName);
    playerMap.set("color", PLAYER_COLORS[joinOrder % PLAYER_COLORS.length]);
    playerMap.set("cellsRemaining", 81);
    playerMap.set("completionPercent", 0);
    playerMap.set("joinOrder", joinOrder);
    players.set(playerId, playerMap);
  });
}

export function setAssistLevel(room: P2PRoom, level: AssistLevel): void {
  room.doc.transact(() => {
    room.doc.getMap("room").set("assistLevel", level);
  });
}

export function setDifficulty(room: P2PRoom, level: Difficulty): void {
  room.doc.transact(() => {
    room.doc.getMap("room").set("difficulty", level);
  });
}

export function startGame(room: P2PRoom, difficulty: Difficulty): void {
  const puzzle = generatePuzzle(difficulty);
  const solution = solvePuzzle(puzzle);
  const clueCount = puzzle.split("").filter((c) => c !== ".").length;

  room.doc.transact(() => {
    const roomMap = room.doc.getMap("room");
    roomMap.set("puzzle", puzzle);
    roomMap.set("solution", solution);
    roomMap.set("difficulty", difficulty);
    roomMap.set("status", "playing");
    roomMap.set("winnerId", null);
    roomMap.set("winnerName", null);
    roomMap.set("gameNumber", ((roomMap.get("gameNumber") as number) || 0) + 1);

    const players = room.doc.getMap("players");
    for (const [, playerMap] of players) {
      const p = playerMap as Y.Map<unknown>;
      p.set("cellsRemaining", 81 - clueCount);
      p.set("completionPercent", 0);
    }
  });
}

export function updatePlayerName(
  room: P2PRoom,
  playerId: string,
  newName: string,
): void {
  const players = room.doc.getMap("players");
  const playerMap = players.get(playerId) as Y.Map<unknown> | undefined;
  if (!playerMap) return;

  room.doc.transact(() => {
    playerMap.set("name", newName);
  });
}

export function updateProgress(
  room: P2PRoom,
  playerId: string,
  cellsRemaining: number,
  completionPercent: number,
): void {
  const players = room.doc.getMap("players");
  const playerMap = players.get(playerId) as Y.Map<unknown> | undefined;
  if (!playerMap) return;

  room.doc.transact(() => {
    playerMap.set("cellsRemaining", cellsRemaining);
    playerMap.set("completionPercent", completionPercent);
  });
}

export function getOpponentProgress(
  room: P2PRoom,
  playerId: string,
): { cellsRemaining: number; completionPercent: number } | null {
  const players = room.doc.getMap("players");
  for (const [id, playerMap] of players) {
    if (id !== playerId) {
      const p = playerMap as Y.Map<unknown>;
      return {
        cellsRemaining: p.get("cellsRemaining") as number,
        completionPercent: p.get("completionPercent") as number,
      };
    }
  }
  return null;
}

export function claimWinner(
  room: P2PRoom,
  playerId: string,
  playerName: string,
): boolean {
  const roomMap = room.doc.getMap("room");
  if (roomMap.get("winnerId") !== null) return false;

  room.doc.transact(() => {
    roomMap.set("winnerId", playerId);
    roomMap.set("winnerName", playerName);
    roomMap.set("status", "finished");
  });
  return true;
}

export function requestRematch(room: P2PRoom, difficulty: Difficulty): void {
  startGame(room, difficulty);
}

export function getRoomStatus(room: P2PRoom): string {
  return room.doc.getMap("room").get("status") as string;
}

export function getPlayers(room: P2PRoom): Player[] {
  const players = room.doc.getMap("players");
  const result: Player[] = [];

  for (const [id, playerMap] of players) {
    const p = playerMap as Y.Map<unknown>;
    result.push({
      id,
      name: p.get("name") as string,
      color: p.get("color") as string,
      cellsRemaining: p.get("cellsRemaining") as number,
      completionPercent: p.get("completionPercent") as number,
    });
  }

  result.sort(
    (a, b) =>
      ((players.get(a.id) as Y.Map<unknown>).get("joinOrder") as number) -
      ((players.get(b.id) as Y.Map<unknown>).get("joinOrder") as number),
  );

  return result;
}

export function destroyRoom(room: P2PRoom): void {
  room.doc.destroy();
}
