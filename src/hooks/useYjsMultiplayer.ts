import { useCallback, useEffect, useRef, useState } from "react";
import type { AssistLevel, Difficulty } from "../lib/types.ts";
import type { Connection, OpenConnection } from "./mp-connection.ts";
import { openWebrtcConnection } from "./mp-connection.webrtc.ts";
import { createRoom, INITIAL_PROJECTION, type Room } from "./mp-room.ts";
import { loadSnapshot, saveSnapshot } from "./mp-snapshot.ts";
import { recordRoomMount } from "./mp-telemetry.ts";
import {
  announcePresence,
  createRoomFromDoc,
  getPlayers,
  getRoomState,
  hydrateRoomFromSnapshot,
  initializeRoom,
  joinRoom,
  observeRoomChanges,
  type P2PRoom,
  presenceHasOpponent,
  requestRematch,
  setAssistLevel as setRoomAssistLevel,
  setDifficulty as setRoomDifficulty,
  startGame,
  updatePlayerName,
  updateProgress,
} from "./p2p-room.ts";

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

// Grace window before applying the localStorage snapshot to an empty
// doc: long enough for WebRTC to deliver the live room when a peer is
// up, short enough that a genuine solo restore feels instant-ish.
const HYDRATE_GRACE_MS = 3_000;

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
  // Fresh object per raise (not a bare string): consumers toast off
  // this value, and a repeat of the same message must still re-fire
  // their effect.
  const [error, setError] = useState<{ message: string } | null>(null);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);

  const roomRef = useRef<Room | null>(null);
  // Second handle on the same doc, for the setup writes the Room does
  // not own yet.
  const p2pRef = useRef<P2PRoom | null>(null);
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
      const p2p = createRoomFromDoc(doc, roomId);
      const room = createRoom({
        doc,
        roomId,
        playerId,
        playerName: () => playerNameRef.current,
      });
      roomRef.current = room;
      p2pRef.current = p2p;
      connectionRef.current = connection;

      const awareness = connection.awareness;

      const unsubscribeRoom = room.subscribe(() => {
        setProjection(room.snapshot());
      });

      const updatePresence = () => {
        const hasOpponent = presenceHasOpponent(
          awareness,
          doc.clientID,
          playerId,
          room.playerCount(),
        );
        // We drop our own WebRTC on hide (see visibility handler), which
        // clears our awareness — don't blame the opponent for that.
        setOpponentDisconnected(
          !document.hidden && !hasOpponent && room.playerCount() > 1,
        );
      };

      awareness.on("change", updatePresence);

      // Track connection status via the transport
      const unsubscribeStatus = connection.onStatus((isConnected) => {
        setConnected(isConnected);
        room.apply({
          type: "connectivity-changed",
          connected: isConnected,
          now: Date.now(),
        });
      });

      // Also listen for peers to detect when WebRTC connects
      const unsubscribePeers = connection.onPeersChange(() => {
        updatePresence();
      });

      setConnected(connection.connected);

      // Synchronous localStorage mirror. y-indexeddb writes are async
      // and iOS Safari doesn't always flush them before killing a
      // backgrounded tab — saveSnapshot survives that.
      const persistSnapshot = () => {
        const state = getRoomState(p2p);
        if (state) saveSnapshot(roomId, state);
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
            announcePresence(awareness, playerId, playerNameRef.current);
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

      // Defer the writes until y-indexeddb has loaded any persisted
      // state. Writing before sync would seed clock-0 ops (initializeRoom
      // defaults, a fresh player Y.Map from joinRoom) that race the
      // restored state — under iOS Safari's flaky IDB flushes on memory
      // pressure, the doc can resolve back to lobby/gameNumber=0 over
      // several reloads, wiping the in-progress game. Helpers are
      // idempotent so post-sync invocation either seeds an empty room or
      // no-ops one already populated.
      let hydrateTimer: ReturnType<typeof setTimeout> | null = null;
      let stopHydrateWatch: (() => void) | null = null;
      void connection.whenSynced.then(() => {
        if (cancelled) return;

        // The creator (came in from the create flow with a chosen
        // difficulty) initializes the room and claims host. Joiners
        // (difficulty=null, came via shared link) skip this and learn
        // host + difficulty from Yjs sync.
        const completeSetup = () => {
          if (cancelled) return;
          const initialDifficulty = initialDifficultyRef.current;
          if (initialDifficulty) {
            initializeRoom(p2p, playerId, initialDifficulty);
          }
          joinRoom(p2p, playerId, playerNameRef.current);
          // An idempotent write that no-ops fires no Yjs observer, yet
          // a refused join still makes us the overflow player.
          room.refresh();
        };

        announcePresence(awareness, playerId, playerNameRef.current);

        // If IDB came back without a started game but localStorage has a
        // recent snapshot, restore from it — but not immediately. The
        // snapshot would land in a fresh doc with a new clientID, making
        // every key causally concurrent with the live peer's state, and
        // per-key LWW could roll a finished game back for both players.
        // Give WebRTC a grace window to deliver the real room first; the
        // snapshot only applies when nothing shows up.
        const yjs = getRoomState(p2p);
        const snap = !yjs || yjs.gameNumber === 0 ? loadSnapshot(roomId) : null;
        if (!snap) {
          completeSetup();
          return;
        }

        const finish = (applySnapshot: boolean) => {
          if (hydrateTimer !== null) {
            clearTimeout(hydrateTimer);
            hydrateTimer = null;
          }
          stopHydrateWatch?.();
          stopHydrateWatch = null;
          if (cancelled) return;
          if (applySnapshot) {
            const current = getRoomState(p2p);
            if (!current || current.gameNumber === 0) {
              hydrateRoomFromSnapshot(p2p, snap);
            }
          }
          completeSetup();
        };
        stopHydrateWatch = observeRoomChanges(p2p, () => {
          const current = getRoomState(p2p);
          if (current && current.gameNumber > 0) finish(false);
        });
        hydrateTimer = setTimeout(() => {
          hydrateTimer = null;
          finish(true);
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
        stopHydrateWatch?.();
        stopHydrateWatch = null;
        awareness.off("change", updatePresence);
        unsubscribeStatus();
        unsubscribePeers();
        unsubscribeRoom();
        // The Room observes the doc the Connection owns — it has to let
        // go before close() destroys it.
        room.close();
        connection.close();
        roomRef.current = null;
        p2pRef.current = null;
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
    const p2p = p2pRef.current;
    if (!p2p) return;

    const players = getPlayers(p2p);
    if (players.length < 2) {
      setError({ message: "Need 2 players to start" });
      return;
    }
    startGame(p2p);
  }, []);

  const sendProgress = useCallback(
    (cellsRemaining: number, completionPercent: number) => {
      const p2p = p2pRef.current;
      if (!p2p) return;
      updateProgress(p2p, playerId, cellsRemaining, completionPercent);
    },
    [playerId],
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
      presenceHasOpponent(
        connection.awareness,
        connection.doc.clientID,
        playerId,
        room.playerCount(),
      );
    room.claimForfeit({ hasOpponent });
  }, [playerId]);

  const sendRematch = useCallback(() => {
    const p2p = p2pRef.current;
    if (!p2p) return;
    requestRematch(p2p);
  }, []);

  const updateName = useCallback(
    (newName: string) => {
      const p2p = p2pRef.current;
      if (!p2p) return;
      updatePlayerName(p2p, playerId, newName);

      // Update awareness too
      const connection = connectionRef.current;
      if (connection) {
        announcePresence(connection.awareness, playerId, newName);
      }
    },
    [playerId],
  );

  const setAssistLevel = useCallback((level: AssistLevel) => {
    const p2p = p2pRef.current;
    if (!p2p) return;
    setRoomAssistLevel(p2p, level);
  }, []);

  const setDifficulty = useCallback((level: Difficulty) => {
    const p2p = p2pRef.current;
    if (!p2p) return;
    setRoomDifficulty(p2p, level);
  }, []);

  return {
    connected,
    ...projection,
    opponentDisconnected,
    error,
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
