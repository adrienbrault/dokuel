import * as Y from "yjs";
import { generatePuzzleWithSolution } from "../lib/sudoku.ts";
import type {
  AssistLevel,
  Difficulty,
  Player,
  RoomState,
} from "../lib/types.ts";
import type { MpSnapshot } from "./mp-snapshot.ts";

/**
 * Internal to the multiplayer module. The only sanctioned production
 * consumer is {@link ./useYjsMultiplayer.ts} (the external seam). The
 * Yjs schema lives here; the hook owns React lifecycle and projects
 * room state for the UI. Co-located in `src/hooks/` so a schema
 * migration touches one directory. Do not import from outside this
 * directory.
 */

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
  return { doc, roomId };
}

/**
 * Initialize a freshly-created room with defaults and claim host.
 * Only the player who created the room (came in from the create flow
 * with a chosen difficulty) calls this. Joiners skip initialization
 * and let Yjs sync deliver the room state.
 *
 * Initializing both peers concurrently would race: each fresh Y.Doc
 * locally sees "no host set yet" before WebRTC has synced, both write
 * `hostId`, and Yjs's last-writer-wins resolution can hand host to the
 * wrong peer. Scoping the write to the creator keeps `hostId` a
 * single-author field that no concurrent write ever fights with.
 *
 * No-op if the room is already initialized — either from local
 * IndexedDB persistence on a refresh, or from a remote update that
 * arrived first.
 */
export function initializeRoom(
  room: P2PRoom,
  hostId: string,
  difficulty: Difficulty,
): void {
  const roomMap = room.doc.getMap("room");
  if (roomMap.has("status")) return;

  room.doc.transact(() => {
    roomMap.set("status", "lobby");
    roomMap.set("difficulty", difficulty);
    roomMap.set("assistLevel", "standard");
    roomMap.set("hostId", hostId);
    roomMap.set("puzzle", null);
    roomMap.set("solution", null);
    roomMap.set("winnerId", null);
    roomMap.set("winnerName", null);
    roomMap.set("winnerBoard", null);
    roomMap.set("gameNumber", 0);
  });
}

/** 1v1: a room holds exactly two players. */
export const MAX_PLAYERS = 2;

export function joinRoom(
  room: P2PRoom,
  playerId: string,
  playerName: string,
): void {
  const players = room.doc.getMap("players");
  if (players.has(playerId)) return;
  // Best-effort cap: catches the common sequential case where the
  // room synced before this join. Two truly concurrent joins can
  // still overflow via CRDT merge — the hook detects that post-merge
  // and flags the excess player (roomFull).
  if (players.size >= MAX_PLAYERS) return;

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

export function startGame(room: P2PRoom, difficulty?: Difficulty): void {
  const roomMap = room.doc.getMap("room");
  const actualDifficulty =
    difficulty ?? ((roomMap.get("difficulty") as Difficulty) || "medium");
  const { puzzle, solution } = generatePuzzleWithSolution(actualDifficulty);
  const clueCount = puzzle.split("").filter((c) => c !== ".").length;

  room.doc.transact(() => {
    roomMap.set("puzzle", puzzle);
    roomMap.set("solution", solution);
    roomMap.set("difficulty", actualDifficulty);
    roomMap.set("status", "playing");
    roomMap.set("winnerId", null);
    roomMap.set("winnerName", null);
    roomMap.set("winnerBoard", null);
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

/**
 * Write a win claim into the room. `board` is the claimant's completed
 * board for a solved win, or null for a forfeit (opponent gone —
 * nothing to verify). The first claim normally wins, with one
 * exception: an existing solved-claim whose board does NOT match the
 * room's solution is forged, and a later claim may overwrite it so a
 * cheater cannot lock the real winner out.
 */
export function claimWinner(
  room: P2PRoom,
  playerId: string,
  playerName: string,
  board: string | null,
): boolean {
  const roomMap = room.doc.getMap("room");
  const existingWinner = roomMap.get("winnerId");
  if (existingWinner !== null && existingWinner !== undefined) {
    const existingBoard = roomMap.get("winnerBoard");
    const solution = roomMap.get("solution");
    const existingIsForged =
      typeof existingBoard === "string" &&
      typeof solution === "string" &&
      existingBoard !== solution;
    if (!existingIsForged) return false;
  }

  room.doc.transact(() => {
    roomMap.set("winnerId", playerId);
    roomMap.set("winnerName", playerName);
    roomMap.set("winnerBoard", board);
    roomMap.set("status", "finished");
  });
  return true;
}

export function requestRematch(room: P2PRoom, difficulty?: Difficulty): void {
  startGame(room, difficulty);
}

export function getRoomStatus(room: P2PRoom): string {
  return room.doc.getMap("room").get("status") as string;
}

export function getHostId(room: P2PRoom): string {
  return (room.doc.getMap("room").get("hostId") as string) || "";
}

/**
 * Snapshot the room into a plain RoomState the React tree can render.
 * Returns null when there is no joined player yet — callers treat that
 * as "lobby has not started syncing."
 */
export function getRoomState(room: P2PRoom): RoomState | null {
  const roomMap = room.doc.getMap("room");
  const status = roomMap.get("status") as string | undefined;
  if (!status) return null;

  const players = getPlayers(room);
  if (players.length === 0) return null;

  return {
    roomId: room.roomId,
    status: status as RoomState["status"],
    difficulty: (roomMap.get("difficulty") as Difficulty) || "medium",
    assistLevel: (roomMap.get("assistLevel") as AssistLevel) || "standard",
    hostId: (roomMap.get("hostId") as string) || "",
    players,
    puzzle: (roomMap.get("puzzle") as string) || null,
    solution: (roomMap.get("solution") as string) || null,
    winnerId: (roomMap.get("winnerId") as string) || null,
    winnerName: (roomMap.get("winnerName") as string) || null,
    // No || coercion here: "" must stay a string (a forged solved-claim
    // the receiver rejects), while null/undefined mean forfeit/legacy.
    winnerBoard:
      typeof roomMap.get("winnerBoard") === "string"
        ? (roomMap.get("winnerBoard") as string)
        : null,
    gameNumber: (roomMap.get("gameNumber") as number) || 0,
    events: [],
  };
}

/**
 * Subscribe to any change in the room or players maps. Returns an
 * unsubscribe function that tears down both observers.
 */
export function observeRoomChanges(
  room: P2PRoom,
  callback: () => void,
): () => void {
  const roomMap = room.doc.getMap("room");
  const playersMap = room.doc.getMap("players");
  roomMap.observe(callback);
  playersMap.observeDeep(callback);
  return () => {
    roomMap.unobserve(callback);
    playersMap.unobserveDeep(callback);
  };
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

  // joinOrder first, playerId as tiebreak: concurrent joiners can both
  // read size 0 and claim the same joinOrder, and every peer must agree
  // on seat order (it decides who the excess player is in an overflow).
  result.sort((a, b) => {
    const orderA = (players.get(a.id) as Y.Map<unknown>).get(
      "joinOrder",
    ) as number;
    const orderB = (players.get(b.id) as Y.Map<unknown>).get(
      "joinOrder",
    ) as number;
    return orderA - orderB || a.id.localeCompare(b.id);
  });

  return result;
}

export function destroyRoom(room: P2PRoom): void {
  room.doc.destroy();
}

/**
 * Seed an empty Yjs room from a localStorage snapshot. Only writes
 * keys that are still missing, so calling this after a partial IDB
 * restore is safe — the peer's eventual sync will reconcile via CRDT.
 * The caller decides when to invoke; typically only when the room has
 * no started game in Yjs but a recent snapshot exists.
 */
export function hydrateRoomFromSnapshot(room: P2PRoom, snap: MpSnapshot): void {
  const roomMap = room.doc.getMap("room");
  const playersMap = room.doc.getMap("players");
  room.doc.transact(() => {
    if (!roomMap.has("status")) roomMap.set("status", snap.status);
    if (!roomMap.has("gameNumber")) roomMap.set("gameNumber", snap.gameNumber);
    if (!roomMap.has("puzzle")) roomMap.set("puzzle", snap.puzzle);
    if (!roomMap.has("solution"))
      roomMap.set("solution", snap.solution ?? null);
    if (!roomMap.has("difficulty")) roomMap.set("difficulty", snap.difficulty);
    if (!roomMap.has("assistLevel"))
      roomMap.set("assistLevel", snap.assistLevel);
    if (!roomMap.has("hostId")) roomMap.set("hostId", snap.hostId);
    if (!roomMap.has("winnerId")) roomMap.set("winnerId", snap.winnerId);
    if (!roomMap.has("winnerName")) roomMap.set("winnerName", snap.winnerName);
    snap.players.forEach((p, joinOrder) => {
      if (playersMap.has(p.id)) return;
      const pm = new Y.Map<unknown>();
      pm.set("name", p.name);
      pm.set("color", p.color);
      pm.set("cellsRemaining", p.cellsRemaining);
      pm.set("completionPercent", p.completionPercent);
      pm.set("joinOrder", joinOrder);
      playersMap.set(p.id, pm);
    });
  });
}

/**
 * Schema for the WebRTC awareness payload — kept here next to the rest
 * of the multiplayer schema so a rename of "user"/"id"/"name" lands in
 * one place. The hook just hands the awareness object in.
 */
type Awareness = {
  getLocalState: () => Record<string, unknown> | null;
  setLocalState: (state: Record<string, unknown>) => void;
  getStates: () => Map<number, { user?: { id: string; name: string } }>;
};

export function announcePresence(
  awareness: Awareness,
  playerId: string,
  playerName: string,
): void {
  // Not setLocalStateField: that helper silently no-ops while the local
  // state is null — which is what y-webrtc's disconnect() leaves behind
  // after we drop WebRTC for a backgrounded tab. Rebuilding the state
  // object makes re-announcing work from any starting point.
  awareness.setLocalState({
    ...(awareness.getLocalState() ?? {}),
    user: { id: playerId, name: playerName },
  });
}

/**
 * True when an awareness peer other than us is present in the room.
 * `playersInRoomCount` lets the caller suppress "opponent disconnected"
 * before a second player has ever joined.
 */
export function presenceHasOpponent(
  awareness: Awareness,
  ownClientId: number,
  ownPlayerId: string,
  playersInRoomCount: number,
): boolean {
  if (playersInRoomCount <= 1) return false;
  for (const [clientId, state] of awareness.getStates()) {
    if (
      clientId !== ownClientId &&
      state.user &&
      state.user.id !== ownPlayerId
    ) {
      return true;
    }
  }
  return false;
}
