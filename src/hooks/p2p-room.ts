import * as Y from "yjs";
import type {
  AssistLevel,
  Difficulty,
  Player,
  RoomState,
} from "../lib/types.ts";
import type { MpSnapshot } from "./mp-snapshot.ts";

/**
 * Internal to the multiplayer module. The Yjs schema and its
 * transactions live here; {@link ./mp-room.ts} builds the room's rules
 * on top of them and is the only importer. Co-located in `src/hooks/`
 * so a schema migration touches one directory. Do not import from
 * outside this directory.
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

/**
 * Add a player's entry. Idempotent, so a reconnect costs nothing.
 * Whether this player may take a seat at all is the Room's decision,
 * made before it asks. `joinOrder` is the entry's own position in this
 * doc; two peers joining concurrently both write the same one, which is
 * why seat order needs a tiebreak.
 */
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

/**
 * Remove a player's entry. Used by the overflow client after a
 * concurrent-join merge left the room with more entries than it holds
 * seats: deleting itself returns the room to a startable lobby.
 */
export function leaveRoom(room: P2PRoom, playerId: string): void {
  const players = room.doc.getMap("players");
  if (!players.has(playerId)) return;
  room.doc.transact(() => {
    players.delete(playerId);
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

/** One dealt game, as the Room decided it. */
export type GameDeal = {
  puzzle: string;
  solution: string;
  difficulty: Difficulty;
  gameNumber: number;
  /** Where every seated player starts on this board. */
  cellsRemaining: number;
};

/**
 * Record a dealt game and put every seated player at the start of it.
 * What to deal, which number it carries and how much of it is left to
 * fill are the Room's decisions; this only lands them, in one
 * transaction so no peer ever observes a half-started game.
 */
export function writeGame(room: P2PRoom, deal: GameDeal): void {
  const roomMap = room.doc.getMap("room");

  room.doc.transact(() => {
    roomMap.set("puzzle", deal.puzzle);
    roomMap.set("solution", deal.solution);
    roomMap.set("difficulty", deal.difficulty);
    roomMap.set("status", "playing");
    roomMap.set("winnerId", null);
    roomMap.set("winnerName", null);
    roomMap.set("winnerBoard", null);
    roomMap.set("gameNumber", deal.gameNumber);

    const players = room.doc.getMap("players");
    for (const [, playerMap] of players) {
      const p = playerMap as Y.Map<unknown>;
      p.set("cellsRemaining", deal.cellsRemaining);
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

/**
 * Record a win claim. `board` is the claimant's completed board for a
 * solved win, or null for a forfeit (opponent gone — nothing to
 * verify). Unconditional: whether this claim outranks one already
 * standing is the Room's judgement, made before it asks for the write.
 */
export function writeClaim(
  room: P2PRoom,
  playerId: string,
  playerName: string,
  board: string | null,
): void {
  const roomMap = room.doc.getMap("room");
  room.doc.transact(() => {
    roomMap.set("winnerId", playerId);
    roomMap.set("winnerName", playerName);
    roomMap.set("winnerBoard", board);
    roomMap.set("status", "finished");
  });
}

export function getRoomStatus(room: P2PRoom): string {
  return room.doc.getMap("room").get("status") as string;
}

export function getHostId(room: P2PRoom): string {
  return (room.doc.getMap("room").get("hostId") as string) || "";
}

function projectWinnerBoard(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  return typeof raw === "string" ? raw : "";
}

/** The room's own fields, as the doc holds them. */
export type RoomFields = Omit<RoomState, "roomId" | "players">;

/**
 * Read the room's fields. Null until something has been written —
 * neither the creator's seed nor a peer's sync has landed yet.
 */
export function readRoom(room: P2PRoom): RoomFields | null {
  const roomMap = room.doc.getMap("room");
  const status = roomMap.get("status") as string | undefined;
  if (!status) return null;

  return {
    status: status as RoomState["status"],
    difficulty: (roomMap.get("difficulty") as Difficulty) || "medium",
    assistLevel: (roomMap.get("assistLevel") as AssistLevel) || "standard",
    hostId: (roomMap.get("hostId") as string) || "",
    puzzle: (roomMap.get("puzzle") as string) || null,
    solution: (roomMap.get("solution") as string) || null,
    winnerId: (roomMap.get("winnerId") as string) || null,
    winnerName: (roomMap.get("winnerName") as string) || null,
    // No || coercion here: "" must stay a string (a forged solved-claim
    // the receiver rejects), while null/undefined mean forfeit/legacy.
    // Anything else a peer wrote is a claim that carries SOMETHING, so
    // it projects to the forged sentinel rather than to the absence of
    // a board — a reader must not judge it a forfeit while the writer
    // judges it forged.
    winnerBoard: projectWinnerBoard(roomMap.get("winnerBoard")),
    gameNumber: (roomMap.get("gameNumber") as number) || 0,
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

/** A player's entry as the doc holds it, before seat order applies. */
export type PlayerEntry = Player & { joinOrder: number };

/**
 * Every player entry in the doc, in whatever order the map yields them.
 * Ordering them into seats — and deciding who is one seat too many — is
 * the Room's rule, not the storage's.
 */
export function readPlayers(room: P2PRoom): PlayerEntry[] {
  const players = room.doc.getMap("players");
  const result: PlayerEntry[] = [];

  for (const [id, playerMap] of players) {
    const p = playerMap as Y.Map<unknown>;
    result.push({
      id,
      name: p.get("name") as string,
      color: p.get("color") as string,
      cellsRemaining: p.get("cellsRemaining") as number,
      completionPercent: p.get("completionPercent") as number,
      joinOrder: p.get("joinOrder") as number,
    });
  }

  return result;
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
