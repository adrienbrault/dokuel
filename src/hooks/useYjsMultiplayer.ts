import { useCallback, useEffect, useRef, useState } from "react";
import type { AssistLevel, Difficulty } from "../lib/types.ts";
import type { Connection, OpenConnection } from "./mp-connection.ts";
import { openWebrtcConnection } from "./mp-connection.webrtc.ts";
import { INITIAL_PROJECTION, type Room } from "./mp-room.ts";
import { startSession } from "./mp-session.ts";
import { recordRoomMount } from "./mp-telemetry.ts";

/**
 * The clock every instant the Room is told about is measured on. It is
 * monotonic where `Date.now` is not: the Room only ever compares and
 * spans instants, and a wall clock that steps backwards (NTP
 * correction, VM restore) would make a deadline unreachable and a
 * countdown negative. Nothing here is persisted or shown to a player,
 * so epoch time buys nothing.
 */
const now = () => performance.now();

type UseYjsMultiplayerOptions = {
  roomId: string;
  playerId: string;
  playerName: string;
  difficulty: Difficulty | null;
  /**
   * The assist level a room this client creates opens on, read from the
   * player's own preference: the create flow no longer stops at a
   * picker. Ignored entirely by a joiner.
   */
  assistLevel?: AssistLevel;
  /**
   * Transport adapter. Defaults to the production WebRTC/IndexedDB one;
   * tests inject the in-memory adapter from ./mp-connection.fake.ts.
   */
  openConnection?: OpenConnection;
};

export function useYjsMultiplayer({
  roomId,
  playerId,
  playerName,
  difficulty,
  assistLevel = "standard",
  openConnection = openWebrtcConnection,
}: UseYjsMultiplayerOptions) {
  const [connected, setConnected] = useState(false);
  // Everything the Room projects, in one value: the Room keeps its
  // identity stable across no-op doc fires, so React bails out of the
  // re-render without the hook comparing anything.
  const [projection, setProjection] = useState(INITIAL_PROJECTION);

  const roomRef = useRef<Room | null>(null);
  const connectionRef = useRef<Connection | null>(null);
  const playerNameRef = useRef(playerName);
  playerNameRef.current = playerName;
  // Captured at mount so the joiner does not stomp on the host's
  // Yjs difficulty when re-renders happen with a different prop value.
  const initialDifficultyRef = useRef(difficulty);
  const initialAssistLevelRef = useRef(assistLevel);
  // Read through a ref for the same reason as playerName: swapping the
  // adapter mid-room is not a thing, and a caller passing an inline
  // factory must not tear the room down on every render.
  const openConnectionRef = useRef(openConnection);
  openConnectionRef.current = openConnection;

  useEffect(() => {
    // Self-diagnostic for the iOS Safari reload problem. Visible to
    // anyone with Safari Web Inspector access; surfaced as a console
    // warn when the same room mounts more than once in an hour.
    const mountCount = recordRoomMount(roomId);
    if (mountCount > 1) {
      console.warn(
        `[dokuel] mp room ${roomId} mounted ${mountCount}× in last hour`,
      );
    }

    let cancelled = false;
    let teardown: (() => void) | null = null;
    // Abandons an open this effect no longer wants. React double-invokes
    // effects under StrictMode, and any remount inside the open window
    // does the same thing in production: without this, the abandoned
    // open still builds a transport, and y-webrtc's globally named room
    // registry hands it the slot the live one needs.
    const opening = new AbortController();

    // Everything below runs once the Connection is open: opening is
    // async because the relay credentials must be resolved before the
    // peer connection exists.
    const start = (connection: Connection): (() => void) => {
      const session = startSession({
        connection,
        roomId,
        playerId,
        playerName: () => playerNameRef.current,
        initialDifficulty: initialDifficultyRef.current,
        initialAssistLevel: initialAssistLevelRef.current,
        now,
        isCancelled: () => cancelled,
        onConnected: setConnected,
        onProjection: setProjection,
      });
      roomRef.current = session.room;
      connectionRef.current = connection;

      return () => {
        session.close();
        roomRef.current = null;
        connectionRef.current = null;
      };
    };

    void openConnectionRef
      .current(roomId, { signal: opening.signal })
      .then((connection) => {
        // Belt and braces: an adapter that resolved anyway still has to
        // leave nothing running behind us.
        if (cancelled) {
          connection.close();
          return;
        }
        teardown = start(connection);
      })
      .catch((error: unknown) => {
        // Our own abort is the expected way an open ends when the room
        // is left; anything else is a real transport failure and stays
        // as loud as it was before.
        if (!cancelled) throw error;
      });

    return () => {
      cancelled = true;
      opening.abort();
      teardown?.();
      teardown = null;
    };
    // playerName is intentionally excluded: it's read via playerNameRef
    // inside the effect, and a rename should not tear down the Y.Doc and
    // start a fresh signaling+IDB session. updateName below routes
    // renames through Yjs without remounting.
  }, [roomId, playerId]);

  const sendStartGame = useCallback(() => {
    roomRef.current?.start();
  }, []);

  const sendProgress = useCallback(
    (cellsRemaining: number, completionPercent: number) => {
      roomRef.current?.progress(cellsRemaining, completionPercent);
    },
    [],
  );

  const sendComplete = useCallback((board: string) => {
    roomRef.current?.complete(board);
  }, []);

  // Forfeit path: the opponent's presence dropped and the grace period
  // ran out. Distinct from sendComplete so an unfinished board is never
  // disguised as a solve.
  const claimForfeitWin = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    // Presence is re-read here, not taken from the Room's last event:
    // the countdown was armed from stale state and the opponent may
    // have reconnected in the meantime.
    const connection = connectionRef.current;
    room.claimForfeit({
      hasOtherPeer: connection?.hasOtherPeer(playerId) ?? false,
    });
  }, [playerId]);

  const sendRematch = useCallback(() => {
    roomRef.current?.rematch();
  }, []);

  const updateName = useCallback(
    (newName: string) => {
      const room = roomRef.current;
      if (!room) return;
      room.updateName(newName);
      // Presence carries the name too, and that lives on the Connection.
      connectionRef.current?.announce({ id: playerId, name: newName });
    },
    [playerId],
  );

  const setAssistLevel = useCallback((level: AssistLevel) => {
    roomRef.current?.setAssistLevel(level);
  }, []);

  const setDifficulty = useCallback((level: Difficulty) => {
    roomRef.current?.setDifficulty(level);
  }, []);

  return {
    connected,
    ...projection,
    sendStartGame,
    sendProgress,
    sendComplete,
    claimForfeitWin,
    sendRematch,
    updateName,
    setAssistLevel,
    setDifficulty,
  };
}
