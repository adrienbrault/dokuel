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

/**
 * Remove a player's entry. Used by the overflow client after a
 * concurrent-join merge left more than MAX_PLAYERS entries: deleting
 * itself returns the room to a startable two-player lobby.
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

export type ClaimVerdict = "solved" | "forfeit" | "forged" | "unverifiable";

/**
 * The one guard over win claims. Every peer can write any winnerId it
 * likes into the CRDT, so a claim is worth only what its board proves:
 *
 * - `solved` — the board equals the room's solution. Always credible.
 * - `forfeit` — no board at all, asserting the opponent vanished.
 *   Nothing here can verify that; only the receiver's own absence
 *   record can back it.
 * - `forged` — a board that does not solve the puzzle. `""` and values
 *   that are not boards at all (a peer can write anything into the
 *   CRDT) land here, which is why getRoomState must not coerce them to
 *   null.
 * - `unverifiable` — a board arrived but the room has no solution to
 *   check it against. Not provably forged, so callers that punish
 *   forgery must leave it alone.
 *
 * Deliberately typed on `unknown`: the write path reads raw Yjs values
 * while the read path holds a projected RoomState, and both must reach
 * the same verdict.
 */
export function judgeClaim(board: unknown, solution: unknown): ClaimVerdict {
  if (board === null || board === undefined) return "forfeit";
  // Only a missing SOLUTION leaves a claim unjudgeable. A board that
  // is not a string is judgeable and false — the room knows what a
  // solved board looks like and this is not one.
  if (typeof solution !== "string") return "unverifiable";
  if (typeof board !== "string") return "forged";
  return board === solution ? "solved" : "forged";
}

/**
 * Write a win claim into the room. `board` is the claimant's completed
 * board for a solved win, or null for a forfeit (opponent gone —
 * nothing to verify). The first claim normally wins, with two
 * exceptions that keep a cheater from locking the real winner out: a
 * forged claim may be overwritten by anyone, and a forfeit claim yields
 * to a verified solved board — a forfeit only means anything while the
 * supposedly absent player never finishes.
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
    const solution = roomMap.get("solution");
    const existing = judgeClaim(roomMap.get("winnerBoard"), solution);
    const mayOverwrite =
      existing === "forged" ||
      (existing === "forfeit" && judgeClaim(board, solution) === "solved");
    if (!mayOverwrite) return false;
  }

  room.doc.transact(() => {
    roomMap.set("winnerId", playerId);
    roomMap.set("winnerName", playerName);
    roomMap.set("winnerBoard", board);
    roomMap.set("status", "finished");
  });
  return true;
}

export function requestRematch(room: P2PRoom, playerId: string): void {
  const state = getRoomState(room);
  if (!state || state.status !== "finished") return;
  const player = room.doc.getMap("players").get(playerId) as
    | Y.Map<unknown>
    | undefined;
  if (!player) return;
  room.doc.transact(() => {
    player.set("rematchGameNumber", state.gameNumber);
    player.set("rematchPuzzle", state.puzzle);
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
    rematchReady: players
      .filter((player) => {
        const map = room.doc.getMap("players").get(player.id) as Y.Map<unknown>;
        return (
          map.get("rematchGameNumber") === roomMap.get("gameNumber") &&
          map.get("rematchPuzzle") === roomMap.get("puzzle")
        );
      })
      .map((player) => player.id),
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
  // Codepoint comparison, NOT localeCompare — collation varies by
  // locale and this order has to be identical on every client.
  result.sort((a, b) => {
    const orderA = (players.get(a.id) as Y.Map<unknown>).get(
      "joinOrder",
    ) as number;
    const orderB = (players.get(b.id) as Y.Map<unknown>).get(
      "joinOrder",
    ) as number;
    if (orderA !== orderB) return orderA - orderB;
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });

  return result;
}

/**
 * Restore an empty room or an initialized, unstarted lobby. A started
 * room keeps its existing fields; the Room owns the grace window that
 * gives live peer state priority over this recovery snapshot.
 * The caller decides when to invoke; typically only when the room has
 * no started game in Yjs but a recent snapshot exists.
 */
export function hydrateRoomFromSnapshot(room: P2PRoom, snap: MpSnapshot): void {
  const roomMap = room.doc.getMap("room");
  const playersMap = room.doc.getMap("players");
  const staleLobby = roomMap.get("gameNumber") === 0 && snap.gameNumber > 0;
  room.doc.transact(() => {
    if (staleLobby || !roomMap.has("status"))
      roomMap.set("status", snap.status);
    if (staleLobby || !roomMap.has("gameNumber"))
      roomMap.set("gameNumber", snap.gameNumber);
    if (staleLobby || !roomMap.has("puzzle"))
      roomMap.set("puzzle", snap.puzzle);
    if (staleLobby || !roomMap.has("solution"))
      roomMap.set("solution", snap.solution ?? null);
    if (staleLobby || !roomMap.has("difficulty"))
      roomMap.set("difficulty", snap.difficulty);
    if (staleLobby || !roomMap.has("assistLevel"))
      roomMap.set("assistLevel", snap.assistLevel);
    if (staleLobby || !roomMap.has("hostId"))
      roomMap.set("hostId", snap.hostId);
    if (staleLobby || !roomMap.has("winnerId"))
      roomMap.set("winnerId", snap.winnerId);
    if (staleLobby || !roomMap.has("winnerName"))
      roomMap.set("winnerName", snap.winnerName);
    snap.players.forEach((p, joinOrder) => {
      if (playersMap.has(p.id) && !staleLobby) return;
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
