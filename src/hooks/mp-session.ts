import { generateId } from "../lib/id.ts";
import { throttleTrailing } from "../lib/throttle.ts";
import type { AssistLevel, Difficulty } from "../lib/types.ts";
import type { Connection, PresenceSignal } from "./mp-connection.ts";
import { createRoom, type Room, type RoomProjection } from "./mp-room.ts";
import { watchTabLifecycle } from "./mp-tab-lifecycle.ts";

/**
 * One live multiplayer session: a Room built on an open Connection,
 * with every listener, timer and hand-off between the two wired up and
 * torn down together.
 *
 * Split out of {@link ./useYjsMultiplayer.ts} because none of it is
 * React - it is the Room-and-Connection wiring, and the binding around
 * it is left with only what a hook can do: hold the session across
 * renders, and push its projection into state.
 */

/**
 * How often the board silhouette may go out. Fast enough that the
 * opponent's grid feels live, slow enough that a quick solver does not
 * turn into one broadcast per cell.
 */
const MASK_PUBLISH_INTERVAL_MS = 250;

/**
 * The floor between two reactions. Four emoji a thumb apart is a spam
 * machine otherwise, and nothing about a race is improved by one.
 */
const REACTION_INTERVAL_MS = 1_000;

/**
 * How long a reaction stays published before the sender withdraws it.
 * Presence is last-write-wins state, not a queue: left standing, the
 * emoji would replay (buzz included) to an opponent who reloads or
 * reconnects minutes later. Comfortably longer than the receiver shows
 * it for, so a slow link still lands the whole moment.
 */
const REACTION_LINGER_MS = 5_000;

export type SessionConfig = {
  connection: Connection;
  roomId: string;
  playerId: string;
  playerName: () => string;
  initialDifficulty: Difficulty | null;
  initialAssistLevel: AssistLevel;
  /** The clock every instant handed to the Room is measured on. */
  now: () => number;
  /**
   * Whether the caller has walked away. Opening is async, so the room
   * can be left between the connection resolving and local persistence
   * finishing its load.
   */
  isCancelled: () => boolean;
  onConnected: (connected: boolean) => void;
  onProjection: (projection: RoomProjection) => void;
  /**
   * The opponent's ephemeral race state, re-read whenever presence
   * moves. Null while nobody is publishing one.
   */
  onOpponentSignal: (signal: PresenceSignal | null) => void;
};

export type Session = {
  room: Room;
  /**
   * Publish this player's board silhouette. Throttled: it is
   * republished on every filled cell and would otherwise be one
   * presence broadcast per keystroke.
   */
  publishMask(mask: string): void;
  /**
   * Throw an emoji at the opponent. Silently refused inside the
   * cooldown - a rate limit the player never has to think about beats
   * a disabled button that flickers.
   */
  sendReaction(emoji: string): void;
  /** Terminal: drops every listener and timer, then closes both sides. */
  close(): void;
};

export function startSession({
  connection,
  roomId,
  playerId,
  playerName,
  initialDifficulty,
  initialAssistLevel,
  now,
  isCancelled,
  onConnected,
  onProjection,
  onOpponentSignal,
}: SessionConfig): Session {
  const room = createRoom({
    doc: connection.doc,
    roomId,
    playerId,
    playerName,
    initialDifficulty,
    initialAssistLevel,
    now,
  });
  const unsubscribeRoom = room.subscribe(() => {
    onProjection(room.snapshot());
  });

  const updatePresence = () => {
    room.apply({
      type: "presence-changed",
      hasOtherPeer: connection.hasOtherPeer(playerId),
      tabHidden: document.hidden,
    });
    onOpponentSignal(connection.opponentSignal(playerId));
  };

  // Track connection status via the transport
  const unsubscribeStatus = connection.onStatus((isConnected) => {
    onConnected(isConnected);
    room.apply({
      type: "connectivity-changed",
      connected: isConnected,
      now: now(),
    });
  });

  const unsubscribePresence = connection.onPresenceChange(updatePresence);

  onConnected(connection.connected);

  const publishMask = throttleTrailing(
    (mask: string) => connection.signal({ mask }),
    MASK_PUBLISH_INTERVAL_MS,
  );

  // Never on the clock's zero: that would be a reaction sent at page
  // load, swallowing the player's first real one.
  let lastReactionAt = Number.NEGATIVE_INFINITY;
  let withdrawTimer: ReturnType<typeof setTimeout> | null = null;
  const sendReaction = (emoji: string) => {
    const at = now();
    if (at - lastReactionAt < REACTION_INTERVAL_MS) return;
    lastReactionAt = at;
    // The nonce is what makes a repeat visible: presence is
    // last-write-wins state, not a message queue, so 🔥 twice in a row
    // is only a change if something in the value changed.
    connection.signal({ reaction: { emoji, at, nonce: generateId() } });
    if (withdrawTimer !== null) clearTimeout(withdrawTimer);
    withdrawTimer = setTimeout(() => {
      withdrawTimer = null;
      connection.signal({ reaction: undefined });
    }, REACTION_LINGER_MS);
  };

  const stopTabLifecycle = watchTabLifecycle({
    connection,
    room,
    now,
    reannounce: () => connection.announce({ id: playerId, name: playerName() }),
    refreshPresence: updatePresence,
  });

  // Nothing may be written before local persistence has loaded:
  // the Room's setup writes would seed clock-0 ops that race the
  // restore, and under iOS Safari's flaky IDB flushes the doc can
  // resolve back to an empty lobby over several reloads, wiping the
  // game in progress.
  let hydrateTimer: ReturnType<typeof setTimeout> | null = null;
  // The Room says when it wants a tick; owning the timer is all we
  // do about it. Re-armed after every tick rather than scheduled
  // once: a timer that fires early leaves the deadline standing,
  // and a deadline nothing wakes up for is a room the player never
  // takes a seat in.
  const armWake = () => {
    const wakeAt = room.nextWakeAt();
    if (wakeAt === null) return;
    hydrateTimer = setTimeout(
      () => {
        hydrateTimer = null;
        room.apply({ type: "tick", now: now() });
        armWake();
      },
      Math.max(0, wakeAt - now()),
    );
  };
  void connection.whenSynced.then(() => {
    if (isCancelled()) return;
    connection.announce({ id: playerId, name: playerName() });
    room.apply({ type: "local-sync-complete", now: now() });
    armWake();
  });

  const close = () => {
    publishMask.cancel();
    if (withdrawTimer !== null) {
      clearTimeout(withdrawTimer);
      withdrawTimer = null;
    }
    stopTabLifecycle();
    if (hydrateTimer !== null) {
      clearTimeout(hydrateTimer);
      hydrateTimer = null;
    }
    unsubscribeStatus();
    unsubscribePresence();
    unsubscribeRoom();
    // The Room observes the doc the Connection owns — it has to let
    // go before close() destroys it.
    room.close();
    connection.close();
  };

  return { room, publishMask, sendReaction, close };
}
