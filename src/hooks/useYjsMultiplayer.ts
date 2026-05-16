import { useCallback, useEffect, useRef, useState } from "react";
import { WebrtcProvider } from "y-webrtc";
import * as Y from "yjs";
import type { AssistLevel, Difficulty, RoomState } from "../lib/types.ts";
import {
  announcePresence,
  claimWinner,
  createRoomFromDoc,
  destroyRoom,
  getHostId,
  getOpponentProgress,
  getPlayers,
  getRoomState,
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
    const provider = new WebrtcProvider(roomId, doc, {
      signaling: ["wss://signal.dokuel.com"],
    });

    const room = createRoomFromDoc(doc, roomId);
    roomRef.current = room;
    providerRef.current = provider;

    joinRoom(room, playerId, playerName);

    // The host publishes their chosen difficulty so joiners see it
    // in the lobby before either player clicks Start. Joiners pass null
    // — they only learn the difficulty once Yjs syncs.
    const initialDifficulty = initialDifficultyRef.current;
    if (initialDifficulty && getHostId(room) === playerId) {
      setRoomDifficulty(room, initialDifficulty);
    }

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

    // Track peer connections via awareness
    const awareness = provider.awareness;
    announcePresence(awareness, playerId, playerName);

    const updatePresence = () => {
      const hasOpponent = presenceHasOpponent(
        awareness,
        doc.clientID,
        playerId,
        getPlayers(room).length,
      );
      setOpponentDisconnected(!hasOpponent && getPlayers(room).length > 1);
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

    // Initial state
    setConnected(provider.connected);
    updateState();

    return () => {
      unobserveRoom();
      awareness.off("change", updatePresence);
      provider.off("status", onStatus);
      provider.off("peers", onPeers);
      provider.disconnect();
      provider.destroy();
      destroyRoom(room);
      roomRef.current = null;
      providerRef.current = null;
    };
  }, [roomId, playerId, playerName]);

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
