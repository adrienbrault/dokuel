import type { Doc } from "yjs";
import { generatePuzzleWithSolution } from "../lib/sudoku.ts";
import type {
  AssistLevel,
  Difficulty,
  Player,
  RoomState,
} from "../lib/types.ts";
import {
  clearSnapshot,
  loadSnapshot,
  type MpSnapshot,
  saveSnapshot,
} from "./mp-snapshot.ts";
import {
  createRoomFromDoc,
  hydrateRoomFromSnapshot,
  initializeRoom,
  joinRoom,
  leaveRoom,
  observeRoomChanges,
  type PlayerEntry,
  readPlayers,
  readRoom,
  setAssistLevel as setRoomAssistLevel,
  setDifficulty as setRoomDifficulty,
  updatePlayerName,
  updateProgress,
  writeClaim,
  writeGame,
} from "./p2p-room.ts";

/**
 * The Room: the rules of one multiplayer match space, with no React, no
 * timers of its own, and no DOM. It reads and writes the Y.Doc it is
 * handed — that doc is its state store — and projects a plain snapshot
 * the UI can render.
 *
 * Everything it cannot observe from the doc arrives as an event
 * ({@link RoomEvent}); everything the player does arrives as a command.
 * Time arrives as an injected clock rather than `Date.now`, so the
 * forfeit trust window is testable without fake timers.
 *
 * {@link ./useYjsMultiplayer.ts} is the React binding around this and
 * the Connection; it owns the timers and the DOM listeners that produce
 * the events.
 */

// How long after our own absence ended a remote forfeit claim is still
// honored. Covers the opponent's 60s countdown plus sync latency for
// the case where we return just as their claim lands.
const FORFEIT_TRUST_WINDOW_MS = 120_000;

// Shape checks for peer-written game content. 81 cells, digits with
// "." holes for a puzzle, digits only for a solution.
const VALID_PUZZLE_RE = /^[1-9.]{81}$/;
const VALID_SOLUTION_RE = /^[1-9]{81}$/;

/**
 * Grace window before a local snapshot is applied to an empty room:
 * long enough for a peer to deliver the live room when one is up, short
 * enough that a genuine solo restore feels instant-ish. Deliberately
 * not exported: the binding schedules against `nextWakeAt()` and never
 * has to know a grace window exists.
 */
const HYDRATE_GRACE_MS = 3_000;

/** 1v1: a room holds exactly two seats. */
export const MAX_PLAYERS = 2;

/**
 * The room's agreed seat order: join order first, player id as
 * tiebreak. Concurrent joiners can both read an empty room and claim
 * the same join order, and every peer must sort them identically —
 * this order is what decides who the overflow player is. Codepoint
 * comparison, NOT localeCompare: collation varies by locale and two
 * clients disagreeing here would evict different players.
 */
function seatPlayers(entries: PlayerEntry[]): Player[] {
  return entries
    .slice()
    .sort((a, b) => {
      if (a.joinOrder !== b.joinOrder) return a.joinOrder - b.joinOrder;
      if (a.id < b.id) return -1;
      if (a.id > b.id) return 1;
      return 0;
    })
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      color: entry.color,
      cellsRemaining: entry.cellsRemaining,
      completionPercent: entry.completionPercent,
    }));
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
 * - `forged` — a board that does not solve the puzzle. `""` lands here,
 *   and so does anything a peer wrote that is not a board at all: the
 *   projection maps those to `""` rather than to null precisely so they
 *   arrive as a claim carrying something worthless instead of as the
 *   absence of a claim.
 * - `unverifiable` — a board arrived but the room has no solution to
 *   check it against. Not provably forged, so callers that punish
 *   forgery must leave it alone.
 *
 * One claim, one verdict: both the Room's write path and its read path
 * judge from the projected room state, so a claim can never be
 * undisplaceable to the writer while being worthless to the reader —
 * which would leave the room with a winner neither side can settle on.
 */
export function judgeClaim(
  board: string | null,
  solution: string | null,
): ClaimVerdict {
  if (board === null) return "forfeit";
  // Only a missing solution leaves a claim unjudgeable. Still a typeof
  // check rather than a null check: the projection casts whatever a
  // peer wrote into `string | null`, and a value that is not a string
  // proves nothing either way.
  if (typeof solution !== "string") return "unverifiable";
  return board === solution ? "solved" : "forged";
}

/**
 * Whether a claim already standing in the room may be written over. The
 * first claim normally wins, with two exceptions that keep a cheater
 * from locking the real winner out: a forged claim may be overwritten
 * by anyone, and a forfeit claim yields to a verified solved board — a
 * forfeit only means anything while the supposedly absent player never
 * finishes.
 */
function mayOverwriteClaim(
  standing: ClaimVerdict,
  incoming: ClaimVerdict,
): boolean {
  return (
    standing === "forged" || (standing === "forfeit" && incoming === "solved")
  );
}

export type OpponentProgress = {
  cellsRemaining: number;
  completionPercent: number;
};

export type GameOverInfo = {
  winnerId: string;
  winnerName: string;
};

/**
 * Everything the UI renders about the room. Identity is stable while
 * nothing changed, so a consumer can compare snapshots by reference —
 * the Yjs observer fires on every keystroke's progress write and a
 * fresh object each time would re-render the whole game tree.
 */
export type RoomProjection = {
  roomState: RoomState | null;
  puzzle: string | null;
  solution: string | null;
  opponentProgress: OpponentProgress | null;
  gameOver: GameOverInfo | null;
  /**
   * The opponent is seated but unreachable. Never true while WE are the
   * one who went away.
   */
  opponentDisconnected: boolean;
  /**
   * Latched true on the first started game and never cleared, so the UI
   * keeps rendering the board even if roomState or puzzle momentarily
   * flicker on a sync race instead of bouncing back to the lobby.
   */
  hasStartedGame: boolean;
  roomFull: boolean;
  /**
   * A fresh object per raise, never a bare string: consumers toast off
   * this value and a repeat of the same message must still re-fire
   * their effect.
   */
  error: { message: string } | null;
};

export const INITIAL_PROJECTION: RoomProjection = {
  roomState: null,
  puzzle: null,
  solution: null,
  opponentProgress: null,
  gameOver: null,
  opponentDisconnected: false,
  hasStartedGame: false,
  roomFull: false,
  error: null,
};

/**
 * What the Room cannot see for itself. Doc changes are not in here: the
 * Room observes its own doc, and Yjs delivers those synchronously.
 */
export type RoomEvent =
  /**
   * Presence was recomputed: the Connection reports whether any other
   * peer is reachable, and the Room combines that with its own seated
   * players. `tabHidden` is here because we release our own transport
   * for a backgrounded tab, which clears our presence — the opponent
   * must not be blamed for our own disappearance.
   */
  | { type: "presence-changed"; hasOtherPeer: boolean; tabHidden: boolean }
  /** The transport's signaling status flipped. */
  | { type: "connectivity-changed"; connected: boolean; now: number }
  /** The tab was backgrounded or came back to the foreground. */
  | { type: "visibility-changed"; hidden: boolean; now: number }
  /**
   * Local persistence finished loading into the doc. Nothing may be
   * written before this: a clock-0 seed would race the restore, and
   * under flaky IDB flushes the room can resolve back to an empty lobby
   * over several reloads and wipe the game in progress.
   */
  | { type: "local-sync-complete"; now: number }
  /** The binding's timer fired. Only the hydration deadline reads it. */
  | { type: "tick"; now: number };

export type Room = {
  apply(event: RoomEvent): void;
  /** Stable-identity projection; unchanged rounds return the same object. */
  snapshot(): RoomProjection;
  /** Called after every projection change, including the Room's own writes. */
  subscribe(listener: () => void): () => void;
  /**
   * The instant the Room wants a `tick` at, or null when it is waiting
   * on nothing. The binding owns the timer; the deadline and its meaning
   * stay here, so neither side has to restate the other's arithmetic.
   */
  nextWakeAt(): number | null;
  /**
   * Claim the win with a completed board. Silently refused unless the
   * board actually solves the room's puzzle — client-side honesty, not
   * server enforcement, but it kills the accidental and one-liner cheat
   * paths.
   */
  complete(board: string): void;
  /**
   * Claim the win because the opponent vanished. `hasOtherPeer` is read
   * from the Connection at claim time, not from the Room's last presence
   * event: the countdown was armed from stale state and a player who
   * just came back must not be steamrolled.
   */
  claimForfeit(options: { hasOtherPeer: boolean }): void;
  /** Deal a new board. Raises an error instead while the room is alone. */
  start(): void;
  /** Same, for a room that already finished a game. */
  rematch(): void;
  progress(cellsRemaining: number, completionPercent: number): void;
  updateName(name: string): void;
  setAssistLevel(level: AssistLevel): void;
  setDifficulty(level: Difficulty): void;
  /**
   * Mirror the room to synchronous local storage. Local persistence is
   * async and a backgrounded tab is not always given time to flush it
   * before the process is killed.
   */
  persistSnapshot(): void;
  /** Stop observing the doc and drop all subscribers. */
  close(): void;
};

export type RoomConfig = {
  doc: Doc;
  roomId: string;
  playerId: string;
  /**
   * Read at write time rather than captured: a rename must reach a
   * claim or a join that has not happened yet.
   */
  playerName: () => string;
  /**
   * Set only by the creator, who came in from the create flow with a
   * chosen difficulty and initialises the room. A joiner arrives by
   * code with null and learns everything — including who the host is —
   * from sync, so it never races the creator for `hostId`.
   */
  initialDifficulty: Difficulty | null;
  /** Injected clock. Only the forfeit trust window reads it. */
  now?: () => number;
};

export function createRoom({
  doc,
  roomId,
  playerId,
  playerName,
  initialDifficulty,
  now = Date.now,
}: RoomConfig): Room {
  const p2p = createRoomFromDoc(doc, roomId);
  const listeners = new Set<() => void>();

  // Serialized last-published room state for the no-op-fire guard.
  let lastRoomStateJson: string | undefined;
  let lastGameNumber = 0;
  // The puzzle latched for lastGameNumber — lets the projection spot a
  // same-number/different-puzzle merge after a start collision.
  let latchedPuzzle: string | null = null;
  // One-shot: this client removed its own overflow entry after losing a
  // concurrent-join seat race.
  let evictedSelf = false;
  // The room's solution, mirrored only when it is shaped like a real
  // grid, so claim verification cannot be poisoned by a peer writing
  // garbage into the CRDT.
  let verifiedSolution: string | null = null;
  // Whether this client actually went away (the transport dropped, or
  // we released it for a backgrounded tab). A remote forfeit claim
  // asserts that we did — it is only honored when this record backs it
  // up, otherwise it is the one-liner devtools cheat. `endedAt` starts
  // at "never": zero would be an absence that just ended on a clock
  // measured from page load, honouring a fabricated forfeit for the
  // whole first trust window of every session.
  const absence = { ongoing: false, endedAt: Number.NEGATIVE_INFINITY };
  // A local snapshot waiting out its grace window. Applying it to a
  // fresh doc makes every key causally concurrent with the live peer's
  // state, and per-key LWW could roll a finished game back for both
  // players — so live state gets first chance.
  let pendingHydration: { snap: MpSnapshot; deadline: number } | null = null;

  const draft: RoomProjection = { ...INITIAL_PROJECTION };
  let published: RoomProjection = { ...INITIAL_PROJECTION };
  let dirty = false;

  function set<K extends keyof RoomProjection>(
    key: K,
    value: RoomProjection[K],
  ): void {
    if (Object.is(draft[key], value)) return;
    draft[key] = value;
    dirty = true;
  }

  /**
   * Snapshot the room into a plain RoomState the UI can render: the
   * doc's own fields plus its players in seat order. Null while there
   * is no joined player yet — callers read that as "the lobby has not
   * started syncing".
   */
  function projectRoomState(): RoomState | null {
    const fields = readRoom(p2p);
    if (!fields) return null;
    const players = seatPlayers(readPlayers(p2p));
    if (players.length === 0) return null;
    return { roomId, ...fields, players };
  }

  function mirrorSolution(state: RoomState): void {
    if (state.solution === null || VALID_SOLUTION_RE.test(state.solution)) {
      verifiedSolution = state.solution;
    }
  }

  /**
   * Adopt a start or a rematch. Content is checked as well as the
   * counter: concurrent starts write the SAME gameNumber with different
   * puzzles and Yjs LWW keeps one, so the losing writer — which latched
   * that number from its own local write — must notice the merge or
   * keep rendering a board whose completion can never validate. A game
   * is only adopted when its content is shaped like a real board; a
   * peer writing garbage must not brick the client.
   */
  function adoptNewGame(state: RoomState): void {
    const contentValid =
      state.puzzle !== null &&
      VALID_PUZZLE_RE.test(state.puzzle) &&
      (state.solution === null || VALID_SOLUTION_RE.test(state.solution));
    const isNewGame = contentValid && state.gameNumber > lastGameNumber;
    const isCollidedGame =
      contentValid &&
      !isNewGame &&
      state.gameNumber === lastGameNumber &&
      state.puzzle !== null &&
      latchedPuzzle !== null &&
      state.puzzle !== latchedPuzzle;
    if (!isNewGame && !isCollidedGame) return;

    lastGameNumber = state.gameNumber;
    latchedPuzzle = state.puzzle;
    set("puzzle", state.puzzle);
    set("solution", state.solution);
    set("gameOver", null);
    set("opponentProgress", null);
    set("hasStartedGame", true);
  }

  /**
   * Judge whoever claimed the win. A remote solved-claim only counts
   * when the board it ships actually equals the solution. A forfeit
   * claim asserts that WE went away, so it only counts when our own
   * absence record agrees; a fabricated forfeit is ignored and later
   * displaced by our verified solve. Our own claims were judged before
   * they were written.
   */
  function detectWinner(state: RoomState, at: number): void {
    if (!state.winnerId || !state.winnerName) return;
    const forfeitBackedByAbsence =
      absence.ongoing || at - absence.endedAt < FORFEIT_TRUST_WINDOW_MS;
    const verdict = judgeClaim(state.winnerBoard, state.solution);
    const claimValid =
      state.winnerId === playerId ||
      (verdict === "forfeit" ? forfeitBackedByAbsence : verdict === "solved");
    if (!claimValid) return;

    set("gameOver", { winnerId: state.winnerId, winnerName: state.winnerName });
    clearSnapshot(roomId);
  }

  function trackOpponentProgress(state: RoomState): void {
    const opponent = state.players.find((p) => p.id !== playerId);
    if (!opponent) return;
    const prev = draft.opponentProgress;
    if (
      prev &&
      prev.cellsRemaining === opponent.cellsRemaining &&
      prev.completionPercent === opponent.completionPercent
    ) {
      return;
    }
    set("opponentProgress", {
      cellsRemaining: opponent.cellsRemaining,
      completionPercent: opponent.completionPercent,
    });
  }

  /**
   * Excess-player detection: not among the first MAX_PLAYERS (our join
   * no-oped), or sorted into the overflow after a concurrent-join
   * merge. The overflow player deletes its own entry so the two seated
   * players get their startable lobby back instead of a ghost row and a
   * disabled Start button.
   */
  function settleSeat(state: RoomState): void {
    const seat = state.players.findIndex((p) => p.id === playerId);
    if (
      state.players.length > MAX_PLAYERS &&
      seat >= MAX_PLAYERS &&
      !evictedSelf
    ) {
      evictedSelf = true;
      leaveRoom(p2p, playerId);
    }
    set(
      "roomFull",
      state.players.length >= MAX_PLAYERS &&
        (seat === -1 || seat >= MAX_PLAYERS),
    );
  }

  /**
   * Seed the room and take a seat. Both helpers are idempotent, so this
   * either populates an empty room or no-ops one that sync already
   * filled.
   */
  function completeSetup(): void {
    if (initialDifficulty) {
      initializeRoom(p2p, playerId, initialDifficulty);
    }
    // Best-effort cap: catches the common sequential case where the
    // room synced before we got here. Two truly concurrent joins can
    // still overflow via CRDT merge, which settleSeat resolves after
    // the fact.
    if (readPlayers(p2p).length < MAX_PLAYERS) {
      joinRoom(p2p, playerId, playerName());
    }
    // A refused join writes nothing and so fires no observer, yet it
    // still means we are the overflow player.
    project();
  }

  function finishHydration(applySnapshot: boolean): void {
    const pending = pendingHydration;
    if (!pending) return;
    pendingHydration = null;
    if (applySnapshot) {
      const current = projectRoomState();
      if (!current || current.gameNumber === 0) {
        hydrateRoomFromSnapshot(p2p, pending.snap);
      }
    }
    completeSetup();
  }

  function project(): void {
    const state = projectRoomState();
    // Live peer state beat the snapshot to it — drop the snapshot.
    if (pendingHydration && state && state.gameNumber > 0) {
      finishHydration(false);
      return;
    }
    // The observer fires per transaction — including our own
    // keystrokes' progress writes. A cheap content compare (the state
    // is ~1KB) keeps identity stable across no-op fires.
    const stateJson = JSON.stringify(state);
    if (stateJson === lastRoomStateJson) return;
    lastRoomStateJson = stateJson;

    set("roomState", state);
    if (state) {
      mirrorSolution(state);
      adoptNewGame(state);
      detectWinner(state, now());
      trackOpponentProgress(state);
      settleSeat(state);
    }
    publish();
  }

  function publish(): void {
    for (const listener of listeners) listener();
  }

  /**
   * A reachable peer only counts as the opponent once a second player
   * has taken a seat: before that, the only awareness entries around are
   * strays, and blaming them would flag a disconnect in a lobby that has
   * never had anyone to disconnect.
   */
  function hasReachableOpponent(hasOtherPeer: boolean): boolean {
    return hasOtherPeer && readPlayers(p2p).length > 1;
  }

  /**
   * Write our claim unless one already standing outranks it. Both
   * verdicts come from the same projected state the receiving side
   * judges, so the two can no longer reach different conclusions about
   * the same claim.
   */
  function claimWin(board: string | null): void {
    const state = projectRoomState();
    if (state?.winnerId) {
      const standing = judgeClaim(state.winnerBoard, state.solution);
      if (!mayOverwriteClaim(standing, judgeClaim(board, state.solution))) {
        return;
      }
    }
    writeClaim(p2p, playerId, playerName(), board);
  }

  /**
   * Deal a board on the room's own difficulty and put both players at
   * the start of it. The game number is bumped here, with the deal it
   * belongs to, so one place decides what "a new game" is; two peers
   * dealing at once write the SAME number with different boards, which
   * is why the projection resolves a collision by content rather than
   * by counter.
   */
  function dealGame(): void {
    const state = projectRoomState();
    const difficulty = state?.difficulty ?? "medium";
    const { puzzle, solution } = generatePuzzleWithSolution(difficulty);
    const clues = puzzle.split("").filter((c) => c !== ".").length;
    writeGame(p2p, {
      puzzle,
      solution,
      difficulty,
      gameNumber: (state?.gameNumber ?? 0) + 1,
      cellsRemaining: 81 - clues,
    });
  }

  function markAbsent(): void {
    absence.ongoing = true;
    absence.endedAt = Number.NEGATIVE_INFINITY;
  }

  function markPresentAgain(at: number): void {
    if (!absence.ongoing) return;
    absence.ongoing = false;
    absence.endedAt = at;
  }

  const unobserve = observeRoomChanges(p2p, project);

  return {
    apply(event) {
      switch (event.type) {
        case "local-sync-complete": {
          const current = projectRoomState();
          const snap =
            !current || current.gameNumber === 0 ? loadSnapshot(roomId) : null;
          if (!snap) {
            completeSetup();
            break;
          }
          pendingHydration = { snap, deadline: event.now + HYDRATE_GRACE_MS };
          break;
        }
        case "tick":
          if (pendingHydration && event.now >= pendingHydration.deadline) {
            finishHydration(true);
          }
          break;
        case "presence-changed":
          set(
            "opponentDisconnected",
            !event.tabHidden &&
              !hasReachableOpponent(event.hasOtherPeer) &&
              readPlayers(p2p).length > 1,
          );
          publish();
          break;
        case "connectivity-changed":
          if (event.connected) markPresentAgain(event.now);
          else markAbsent();
          break;
        case "visibility-changed":
          // Going hidden is not yet an absence: the binding keeps the
          // transport for a debounce window first, and tells us when it
          // actually releases it.
          if (!event.hidden) markPresentAgain(event.now);
          break;
      }
    },
    snapshot() {
      if (dirty) {
        published = { ...draft };
        dirty = false;
      }
      return published;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    nextWakeAt() {
      return pendingHydration?.deadline ?? null;
    },
    complete(board) {
      if (judgeClaim(board, verifiedSolution) !== "solved") return;
      claimWin(board);
    },
    claimForfeit({ hasOtherPeer }) {
      if (hasReachableOpponent(hasOtherPeer)) return;
      claimWin(null);
    },
    start() {
      if (readPlayers(p2p).length < 2) {
        set("error", { message: "Need 2 players to start" });
        publish();
        return;
      }
      dealGame();
    },
    rematch() {
      dealGame();
    },
    progress(cellsRemaining, completionPercent) {
      updateProgress(p2p, playerId, cellsRemaining, completionPercent);
    },
    updateName(name) {
      updatePlayerName(p2p, playerId, name);
    },
    setAssistLevel(level) {
      setRoomAssistLevel(p2p, level);
    },
    setDifficulty(level) {
      setRoomDifficulty(p2p, level);
    },
    persistSnapshot() {
      const state = projectRoomState();
      if (state) saveSnapshot(roomId, state);
    },
    close() {
      unobserve();
      listeners.clear();
    },
  };
}
