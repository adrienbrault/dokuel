import { useCallback, useEffect, useRef, useState } from "react";
import { IndexeddbPersistence } from "y-indexeddb";
import { WebrtcProvider } from "y-webrtc";
import * as Y from "yjs";
import type { AssistLevel, Difficulty, RoomState } from "../lib/types.ts";
import {
  announcePresence,
  claimWinner,
  createRoomFromDoc,
  destroyRoom,
  getOpponentProgress,
  getPlayers,
  getRoomState,
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
};

type OpponentProgress = {
  cellsRemaining: number;
  completionPercent: number;
};

type GameOverInfo = {
  winnerId: string;
  winnerName: string;
};

export function useYjsMultiplayer({
  roomId,
  playerId,
  playerName,
  difficulty,
}: UseYjsMultiplayerOptions) {
  const [connected, setConnected] = useState(false);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [puzzle, setPuzzle] = useState<string | null>(null);
  const [opponentProgress, setOpponentProgress] =
    useState<OpponentProgress | null>(null);
  const [gameOver, setGameOver] = useState<GameOverInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  // Latched true on first gameNumber > 0 and never cleared. Lets the UI
  // keep rendering the board even if roomState or puzzle momentarily
  // flicker (Yjs sync race, transient peer state), instead of bouncing
  // back to the lobby/connecting screen and unmounting local state.
  const [hasStartedGame, setHasStartedGame] = useState(false);

  const roomRef = useRef<P2PRoom | null>(null);
  const providerRef = useRef<WebrtcProvider | null>(null);
  const lastGameNumberRef = useRef<number>(0);
  const playerNameRef = useRef(playerName);
  playerNameRef.current = playerName;
  // Captured at mount so the joiner does not stomp on the host's
  // Yjs difficulty when re-renders happen with a different prop value.
  const initialDifficultyRef = useRef(difficulty);

  useEffect(() => {
    const doc = new Y.Doc();
    // Persist the doc locally so a tab refresh, brief disconnect, or
    // background tab eviction doesn't lose progress. The `dokuel_`
    // prefix scopes our DBs apart from anything else on the origin.
    const persistence = new IndexeddbPersistence(`dokuel_${roomId}`, doc);
    const provider = new WebrtcProvider(roomId, doc, {
      signaling: ["wss://signal.dokuel.com"],
    });

    const room = createRoomFromDoc(doc, roomId);
    roomRef.current = room;
    providerRef.current = provider;

    const awareness = provider.awareness;

    const updateState = () => {
      const state = getRoomState(room);
      setRoomState(state);
      if (!state) return;

      // Detect new game (start or rematch)
      if (state.gameNumber > lastGameNumberRef.current) {
        lastGameNumberRef.current = state.gameNumber;
        setPuzzle(state.puzzle);
        setGameOver(null);
        setOpponentProgress(null);
        setHasStartedGame(true);
      }

      // Detect winner
      if (state.winnerId && state.winnerName) {
        setGameOver({
          winnerId: state.winnerId,
          winnerName: state.winnerName,
        });
      }

      // Update opponent progress
      const progress = getOpponentProgress(room, playerId);
      if (progress) {
        setOpponentProgress(progress);
      }
    };

    const unobserveRoom = observeRoomChanges(room, updateState);

    const updatePresence = () => {
      const hasOpponent = presenceHasOpponent(
        awareness,
        doc.clientID,
        playerId,
        getPlayers(room).length,
      );
      // We drop our own WebRTC on hide (see visibility handler), which
      // clears our awareness — don't blame the opponent for that.
      setOpponentDisconnected(
        !document.hidden && !hasOpponent && getPlayers(room).length > 1,
      );
    };

    awareness.on("change", updatePresence);

    // Track connection status via provider
    const onStatus = ({ connected: isConnected }: { connected: boolean }) => {
      setConnected(isConnected);
    };
    provider.on("status", onStatus);

    // Also listen for peers to detect when WebRTC connects
    const onPeers = () => {
      updatePresence();
    };
    provider.on("peers", onPeers);

    setConnected(provider.connected);

    // Release WebRTC peer connections + signaling sockets while the
    // tab is backgrounded: iOS Safari kills tabs under memory pressure
    // and RTCPeerConnections are the dominant cost here. Y.Doc and
    // persistence stay alive across the cycle.
    const HIDE_DEBOUNCE_MS = 15_000;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    const handleVisibility = () => {
      if (document.hidden) {
        if (hideTimer === null) {
          hideTimer = setTimeout(() => {
            provider.disconnect();
            hideTimer = null;
          }, HIDE_DEBOUNCE_MS);
        }
      } else {
        if (hideTimer !== null) {
          clearTimeout(hideTimer);
          hideTimer = null;
        }
        if (!provider.connected) {
          provider.connect();
          announcePresence(awareness, playerId, playerNameRef.current);
        }
      }
      updatePresence();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // Defer the writes until y-indexeddb has loaded any persisted
    // state. Writing before sync would seed clock-0 ops (initializeRoom
    // defaults, a fresh player Y.Map from joinRoom) that race the
    // restored state — under iOS Safari's flaky IDB flushes on memory
    // pressure, the doc can resolve back to lobby/gameNumber=0 over
    // several reloads, wiping the in-progress game. Helpers are
    // idempotent so post-sync invocation either seeds an empty room or
    // no-ops one already populated.
    let cancelled = false;
    void persistence.whenSynced.then(() => {
      if (cancelled) return;

      // The creator (came in from the create flow with a chosen
      // difficulty) initializes the room and claims host. Joiners
      // (difficulty=null, came via shared link) skip this and learn
      // host + difficulty from Yjs sync.
      const initialDifficulty = initialDifficultyRef.current;
      if (initialDifficulty) {
        initializeRoom(room, playerId, initialDifficulty);
      }
      joinRoom(room, playerId, playerNameRef.current);

      announcePresence(awareness, playerId, playerNameRef.current);
      updateState();
    });

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      if (hideTimer !== null) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
      unobserveRoom();
      awareness.off("change", updatePresence);
      provider.off("status", onStatus);
      provider.off("peers", onPeers);
      provider.disconnect();
      provider.destroy();
      persistence.destroy();
      destroyRoom(room);
      roomRef.current = null;
      providerRef.current = null;
    };
    // playerName is intentionally excluded: it's read via playerNameRef
    // inside the effect, and a rename should not tear down the Y.Doc and
    // start a fresh signaling+IDB session. updateName below routes
    // renames through Yjs without remounting.
  }, [roomId, playerId]);

  const sendStartGame = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;

    const players = getPlayers(room);
    if (players.length < 2) {
      setError("Need 2 players to start");
      return;
    }
    startGame(room);
  }, []);

  const sendProgress = useCallback(
    (cellsRemaining: number, completionPercent: number) => {
      const room = roomRef.current;
      if (!room) return;
      updateProgress(room, playerId, cellsRemaining, completionPercent);
    },
    [playerId],
  );

  const sendComplete = useCallback(
    (_board: string) => {
      const room = roomRef.current;
      if (!room) return;
      claimWinner(room, playerId, playerNameRef.current);
    },
    [playerId],
  );

  const sendRematch = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    requestRematch(room);
  }, []);

  const updateName = useCallback(
    (newName: string) => {
      const room = roomRef.current;
      if (!room) return;
      updatePlayerName(room, playerId, newName);

      // Update awareness too
      const provider = providerRef.current;
      if (provider) {
        announcePresence(provider.awareness, playerId, newName);
      }
    },
    [playerId],
  );

  const setAssistLevel = useCallback((level: AssistLevel) => {
    const room = roomRef.current;
    if (!room) return;
    setRoomAssistLevel(room, level);
  }, []);

  const setDifficulty = useCallback((level: Difficulty) => {
    const room = roomRef.current;
    if (!room) return;
    setRoomDifficulty(room, level);
  }, []);

  return {
    connected,
    roomState,
    puzzle,
    opponentProgress,
    opponentDisconnected,
    gameOver,
    hasStartedGame,
    error,
    sendStartGame,
    sendProgress,
    sendComplete,
    sendRematch,
    updateName,
    setAssistLevel,
    setDifficulty,
  };
}
