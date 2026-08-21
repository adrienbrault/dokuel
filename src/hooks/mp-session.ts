import type { AssistLevel, Difficulty } from "../lib/types.ts";
import type { Connection, OpenConnection } from "./mp-connection.ts";
import {
  createRoom,
  INITIAL_PROJECTION,
  type RoomProjection,
} from "./mp-room.ts";

/**
 * The room session: one client's participation in a room. It opens a
 * {@link Connection}, builds a {@link ./mp-room.ts Room} over the doc
 * that Connection owns, and holds the policy that lives between the two
 * — releasing the transport for a backgrounded tab, reconnecting and
 * re-announcing when the player comes back, mirroring the room to local
 * storage before the process can be killed, and waking the Room when it
 * asks to be woken.
 *
 * Deliberately headless: no `document`, no `window`, and every instant
 * read through an injected clock. The React binding
 * ({@link ./useYjsMultiplayer.ts}) forwards DOM events in and renders
 * the snapshot out; it decides nothing.
 */

// Release WebRTC peer connections + signaling sockets while the tab is
// backgrounded: iOS Safari kills tabs under memory pressure and
// RTCPeerConnections are the dominant cost here. Y.Doc and persistence
// stay alive across the cycle, so a short trip away costs nothing —
// hence the debounce rather than an immediate release.
const HIDE_DEBOUNCE_MS = 15_000;

type TimerHandle = ReturnType<typeof setTimeout>;

/** The scheduler the session's policy runs on. */
export type Timers = {
  setTimeout: (callback: () => void, ms: number) => TimerHandle;
  clearTimeout: (handle: TimerHandle) => void;
};

const realTimers: Timers = {
  // Delegated rather than captured: a test that installs fake timers
  // after the session was built must still be in control of it.
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => {
    clearTimeout(handle);
  },
};

/** Everything the UI renders about the session, in one value. */
export type RoomSessionSnapshot = RoomProjection & { connected: boolean };

export type RoomSession = {
  /**
   * Stable-identity snapshot; unchanged rounds return the same object,
   * so a consumer can bail out of a re-render by reference. The initial
   * projection until the Connection is open.
   */
  snapshot(): RoomSessionSnapshot;
  subscribe(listener: () => void): () => void;
  /** The tab was backgrounded or came back to the foreground. */
  visibilityChanged(hidden: boolean): void;
  /** The page is going away — mirror the room while we still can. */
  pageHidden(): void;
  start(): void;
  rematch(): void;
  progress(cellsRemaining: number, completionPercent: number): void;
  complete(board: string): void;
  claimForfeit(): void;
  updateName(name: string): void;
  setAssistLevel(level: AssistLevel): void;
  setDifficulty(level: Difficulty): void;
  /** Abandon an open still in flight, then tear everything down. */
  close(): void;
};

export type RoomSessionConfig = {
  roomId: string;
  playerId: string;
  /** Read at write time: a rename must reach a join that has not happened yet. */
  playerName: () => string;
  initialDifficulty: Difficulty | null;
  openConnection: OpenConnection;
  /**
   * The clock every instant is measured on. Monotonic where `Date.now`
   * is not: only spans and comparisons are ever taken, and a wall clock
   * that steps backwards (NTP correction, VM restore) would make a
   * deadline unreachable and a countdown negative.
   */
  now?: () => number;
  timers?: Timers;
};

export function createRoomSession({
  roomId,
  playerId,
  playerName,
  initialDifficulty,
  openConnection,
  now = () => performance.now(),
  timers = realTimers,
}: RoomSessionConfig): RoomSession {
  const listeners = new Set<() => void>();
  // Abandons an open this session no longer wants. Opening is async,
  // and y-webrtc keys its room registry globally by name: a transport
  // built for a room nobody is in claims the slot the live one needs.
  const opening = new AbortController();

  let room: ReturnType<typeof createRoom> | null = null;
  let connection: Connection | null = null;
  let teardown: (() => void) | null = null;
  let closed = false;
  // Tracked rather than read from `document`: the session has no DOM.
  // It starts false because a room is opened from a foreground tab; a
  // mount into an already-hidden tab is corrected by the first event.
  let hidden = false;
  let connected = false;
  let hideTimer: TimerHandle | null = null;
  let wakeTimer: TimerHandle | null = null;

  let publishedProjection: RoomProjection = INITIAL_PROJECTION;
  let published: RoomSessionSnapshot = { ...INITIAL_PROJECTION, connected };

  function publish(): void {
    for (const listener of listeners) listener();
  }

  function updatePresence(): void {
    if (!room || !connection) return;
    room.apply({
      type: "presence-changed",
      hasOtherPeer: connection.hasOtherPeer(playerId),
      tabHidden: hidden,
    });
  }

  /**
   * The Room says when it wants a tick; owning the timer is all we do
   * about it. Re-armed after every tick rather than scheduled once: a
   * timer that fires early leaves the deadline standing, and a deadline
   * nothing wakes up for is a room the player never takes a seat in.
   */
  function armWake(): void {
    const wakeAt = room?.nextWakeAt() ?? null;
    if (wakeAt === null) return;
    wakeTimer = timers.setTimeout(
      () => {
        wakeTimer = null;
        room?.apply({ type: "tick", now: now() });
        armWake();
      },
      Math.max(0, wakeAt - now()),
    );
  }

  function releaseTransport(): void {
    hideTimer = null;
    connection?.disconnect();
    // Told rather than waited for: the Connection contract does not
    // promise a status event for a disconnect we asked for ourselves.
    // Without this the Room never records the absence, and the forfeit
    // claim the opponent is about to make would look fabricated.
    room?.apply({ type: "connectivity-changed", connected: false, now: now() });
  }

  function begin(opened: Connection): void {
    connection = opened;
    room = createRoom({
      doc: opened.doc,
      roomId,
      playerId,
      playerName,
      initialDifficulty,
      now,
    });

    const unsubscribeRoom = room.subscribe(publish);
    const unsubscribeStatus = opened.onStatus((isConnected) => {
      connected = isConnected;
      room?.apply({
        type: "connectivity-changed",
        connected: isConnected,
        now: now(),
      });
      publish();
    });
    const unsubscribePresence = opened.onPresenceChange(updatePresence);
    connected = opened.connected;

    // Nothing may be written before local persistence has loaded: the
    // Room's setup writes would seed clock-0 ops that race the restore,
    // and under flaky IDB flushes the doc can resolve back to an empty
    // lobby over several reloads, wiping the game in progress.
    void opened.whenSynced.then(() => {
      if (closed) return;
      opened.announce({ id: playerId, name: playerName() });
      room?.apply({ type: "local-sync-complete", now: now() });
      armWake();
      publish();
    });

    teardown = () => {
      if (hideTimer !== null) timers.clearTimeout(hideTimer);
      if (wakeTimer !== null) timers.clearTimeout(wakeTimer);
      hideTimer = null;
      wakeTimer = null;
      unsubscribeStatus();
      unsubscribePresence();
      unsubscribeRoom();
      // The Room observes the doc the Connection owns — it has to let
      // go before close() destroys it.
      room?.close();
      opened.close();
      room = null;
      connection = null;
    };
  }

  void openConnection(roomId, { signal: opening.signal })
    .then((opened) => {
      // Belt and braces behind the abort: an adapter that resolved
      // anyway must not leave a live transport behind for a room the
      // player already left.
      if (closed) {
        opened.close();
        return;
      }
      begin(opened);
      publish();
    })
    .catch((error: unknown) => {
      // Our own abort is the expected way an open ends when the room is
      // left; anything else is a real transport failure and stays as
      // loud as it was before.
      if (!closed) throw error;
    });

  return {
    snapshot() {
      const projection = room?.snapshot() ?? INITIAL_PROJECTION;
      if (
        projection !== publishedProjection ||
        published.connected !== connected
      ) {
        publishedProjection = projection;
        published = { ...projection, connected };
      }
      return published;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    visibilityChanged(isHidden) {
      hidden = isHidden;
      if (isHidden) {
        // Local persistence is async and a backgrounded tab is not
        // always given time to flush it before the process is killed.
        room?.persistSnapshot();
        if (hideTimer === null) {
          hideTimer = timers.setTimeout(releaseTransport, HIDE_DEBOUNCE_MS);
        }
      } else {
        if (hideTimer !== null) timers.clearTimeout(hideTimer);
        hideTimer = null;
        if (connection && !connection.connected) {
          connection.connect();
          // The disconnect cleared our own presence entry (see the
          // Connection contract), and announcing is the only way back:
          // without it the opponent keeps seeing us as gone and is
          // offered a forfeit win while we are actively playing.
          connection.announce({ id: playerId, name: playerName() });
        }
      }
      room?.apply({ type: "visibility-changed", hidden: isHidden, now: now() });
      updatePresence();
    },
    pageHidden() {
      room?.persistSnapshot();
    },
    start() {
      room?.start();
    },
    rematch() {
      room?.rematch();
    },
    progress(cellsRemaining, completionPercent) {
      room?.progress(cellsRemaining, completionPercent);
    },
    complete(board) {
      room?.complete(board);
    },
    claimForfeit() {
      // Presence is re-read here, not taken from the Room's last event:
      // the countdown was armed from stale state and the opponent may
      // have reconnected in the meantime.
      room?.claimForfeit({
        hasOtherPeer: connection?.hasOtherPeer(playerId) ?? false,
      });
    },
    updateName(name) {
      room?.updateName(name);
      // Presence carries the name too, and that lives on the Connection.
      connection?.announce({ id: playerId, name });
    },
    setAssistLevel(level) {
      room?.setAssistLevel(level);
    },
    setDifficulty(level) {
      room?.setDifficulty(level);
    },
    close() {
      closed = true;
      opening.abort();
      teardown?.();
      teardown = null;
      listeners.clear();
    },
  };
}
