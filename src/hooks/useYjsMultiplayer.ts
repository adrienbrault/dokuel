import { useCallback, useEffect, useRef, useState } from "react";
import { WebrtcProvider } from "y-webrtc";
import * as Y from "yjs";
import { SIGNALING_URL } from "../lib/constants.ts";
import {
  claimWinner,
  createRoomFromDoc,
  destroyRoom,
  getOpponentProgress,
  getPlayers,
  joinRoom,
  type P2PRoom,
  requestRematch,
  setAssistLevel as setRoomAssistLevel,
  startGame,
  updatePlayerName,
  updateProgress,
} from "../lib/p2p-room.ts";
import type { AssistLevel, Difficulty, RoomState } from "../lib/types.ts";

type UseYjsMultiplayerOptions = {
  roomId: string;
  playerId: string;
  playerName: string;
  difficulty: Difficulty;
};

type OpponentProgress = {
  cellsRemaining: number;
  completionPercent: number;
};

type GameOverInfo = {
  winnerId: string;
  winnerName: string;
};

function deriveRoomState(room: P2PRoom): RoomState | null {
  const roomMap = room.doc.getMap("room");
  const status = roomMap.get("status") as string | undefined;
  if (!status) return null;

  const players = getPlayers(room);
  if (players.length === 0) return null;

  return {
    roomId: room.roomId,
    status: status as RoomState["status"],
    difficulty: (roomMap.get("difficulty") as Difficulty) || "medium",
    assistLevel: (roomMap.get("assistLevel") as AssistLevel) || "standard",
    hostId: (roomMap.get("hostId") as string) || "",
    players,
    puzzle: (roomMap.get("puzzle") as string) || null,
    winnerId: (roomMap.get("winnerId") as string) || null,
    events: [],
  };
}

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

  useEffect(() => {
    // --- Connection setup ---
    const doc = new Y.Doc();
    const provider = new WebrtcProvider(roomId, doc, {
      signaling: [SIGNALING_URL],
    });
    const room = createRoomFromDoc(doc, roomId);
    roomRef.current = room;
    providerRef.current = provider;
    joinRoom(room, playerId, playerName);

    // --- Room state derivation ---
    const updateState = () => {
      const state = deriveRoomState(room);
      setRoomState(state);
      if (!state) return;

      const roomMap = doc.getMap("room");
      const currentPuzzle = roomMap.get("puzzle") as string | null;
      const gameNumber = (roomMap.get("gameNumber") as number) || 0;
      const winnerId = roomMap.get("winnerId") as string | null;
      const winnerName = roomMap.get("winnerName") as string | null;

      if (gameNumber > lastGameNumberRef.current) {
        lastGameNumberRef.current = gameNumber;
        setPuzzle(currentPuzzle);
        setGameOver(null);
        setOpponentProgress(null);
      }
      if (winnerId && winnerName) {
        setGameOver({ winnerId, winnerName });
      }
      const progress = getOpponentProgress(room, playerId);
      if (progress) setOpponentProgress(progress);
    };

    // --- Room map observers ---
    const roomMap = doc.getMap("room");
    roomMap.observe(updateState);
    const playersMap = doc.getMap("players");
    playersMap.observeDeep(updateState);

    // --- Awareness / presence tracking ---
    const awareness = provider.awareness;
    awareness.setLocalStateField("user", { id: playerId, name: playerName });
    const updatePresence = () => {
      const states = awareness.getStates();
      let hasOpponent = false;
      for (const [clientId, state] of states) {
        if (
          clientId !== doc.clientID &&
          state.user &&
          state.user.id !== playerId
        ) {
          hasOpponent = true;
          break;
        }
      }
      setOpponentDisconnected(!hasOpponent && getPlayers(room).length > 1);
    };
    awareness.on("change", updatePresence);

    // --- Connection status ---
    const onStatus = ({ connected: isConnected }: { connected: boolean }) => {
      setConnected(isConnected);
    };
    provider.on("status", onStatus);
    const onPeers = () => updatePresence();
    provider.on("peers", onPeers);

    // Initial state
    setConnected(provider.connected);
    updateState();

    return () => {
      roomMap.unobserve(updateState);
      playersMap.unobserveDeep(updateState);
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

    startGame(room, difficulty);
  }, [difficulty]);

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
    requestRematch(room, difficulty);
  }, [difficulty]);

  const updateName = useCallback(
    (newName: string) => {
      const room = roomRef.current;
      if (!room) return;
      updatePlayerName(room, playerId, newName);

      // Update awareness too
      const provider = providerRef.current;
      if (provider) {
        provider.awareness.setLocalStateField("user", {
          id: playerId,
          name: newName,
        });
      }
    },
    [playerId],
  );

  const setAssistLevel = useCallback((level: AssistLevel) => {
    const room = roomRef.current;
    if (!room) return;
    setRoomAssistLevel(room, level);
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
  };
}
