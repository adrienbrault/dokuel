import { useCallback, useEffect, useRef, useState } from "react";
import type { AssistLevel, Difficulty } from "../lib/types.ts";
import type { Connection, OpenConnection } from "./mp-connection.ts";
import { openWebrtcConnection } from "./mp-connection.webrtc.ts";
import {
  createRoom,
  HYDRATE_GRACE_MS,
  INITIAL_PROJECTION,
  type Room,
} from "./mp-room.ts";
import { recordRoomMount } from "./mp-telemetry.ts";

type UseYjsMultiplayerOptions = {
  roomId: string;
  playerId: string;
  playerName: string;
  difficulty: Difficulty | null;
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

    // Everything below runs once the Connection is open: opening is
    // async because the relay credentials must be resolved before the
    // peer connection exists.
    const start = (connection: Connection): (() => void) => {
      const doc = connection.doc;
      const room = createRoom({
        doc,
        roomId,
        playerId,
        playerName: () => playerNameRef.current,
        initialDifficulty: initialDifficultyRef.current,
      });
      roomRef.current = room;
      connectionRef.current = connection;

      const unsubscribeRoom = room.subscribe(() => {
        setProjection(room.snapshot());
      });

      const updatePresence = () => {
        room.apply({
          type: "presence-changed",
          hasOpponent:
            room.playerCount() > 1 && connection.hasOtherPeer(playerId),
          tabHidden: document.hidden,
        });
      };

      // Track connection status via the transport
      const unsubscribeStatus = connection.onStatus((isConnected) => {
        setConnected(isConnected);
        room.apply({
          type: "connectivity-changed",
          connected: isConnected,
          now: Date.now(),
        });
      });

      const unsubscribePresence = connection.onPresenceChange(updatePresence);

      setConnected(connection.connected);

      const persistSnapshot = () => {
        room.persistSnapshot();
      };

      // Release WebRTC peer connections + signaling sockets while the
      // tab is backgrounded: iOS Safari kills tabs under memory pressure
      // and RTCPeerConnections are the dominant cost here. Y.Doc and
      // persistence stay alive across the cycle.
      const HIDE_DEBOUNCE_MS = 15_000;
      let hideTimer: ReturnType<typeof setTimeout> | null = null;
      const handleVisibility = () => {
        if (document.hidden) {
          persistSnapshot();
          if (hideTimer === null) {
            hideTimer = setTimeout(() => {
              connection.disconnect();
              room.apply({
                type: "connectivity-changed",
                connected: false,
                now: Date.now(),
              });
              hideTimer = null;
            }, HIDE_DEBOUNCE_MS);
          }
        } else {
          if (hideTimer !== null) {
            clearTimeout(hideTimer);
            hideTimer = null;
          }
          if (!connection.connected) {
            connection.connect();
            connection.announce({ id: playerId, name: playerNameRef.current });
          }
        }
        room.apply({
          type: "visibility-changed",
          hidden: document.hidden,
          now: Date.now(),
        });
        updatePresence();
      };
      document.addEventListener("visibilitychange", handleVisibility);
      window.addEventListener("pagehide", persistSnapshot);

      // Nothing may be written before local persistence has loaded:
      // the Room's setup writes would seed clock-0 ops that race the
      // restore, and under iOS Safari's flaky IDB flushes the doc can
      // resolve back to an empty lobby over several reloads, wiping the
      // game in progress.
      let hydrateTimer: ReturnType<typeof setTimeout> | null = null;
      void connection.whenSynced.then(() => {
        if (cancelled) return;
        connection.announce({ id: playerId, name: playerNameRef.current });
        room.apply({ type: "local-sync-complete", now: Date.now() });
        // The Room may now be holding a local snapshot back to give a
        // live peer first chance; this is the deadline it waits on.
        hydrateTimer = setTimeout(() => {
          hydrateTimer = null;
          room.apply({ type: "tick", now: Date.now() });
        }, HYDRATE_GRACE_MS);
      });

      return () => {
        document.removeEventListener("visibilitychange", handleVisibility);
        window.removeEventListener("pagehide", persistSnapshot);
        if (hideTimer !== null) {
          clearTimeout(hideTimer);
          hideTimer = null;
        }
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
        roomRef.current = null;
        connectionRef.current = null;
      };
    };

    void openConnectionRef.current(roomId).then((connection) => {
      if (cancelled) {
        connection.close();
        return;
      }
      teardown = start(connection);
    });

    return () => {
      cancelled = true;
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
    const hasOpponent =
      connection !== null &&
      room.playerCount() > 1 &&
      connection.hasOtherPeer(playerId);
    room.claimForfeit({ hasOpponent });
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
