import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomState, ServerMessage } from "../lib/types.ts";

type OpponentProgress = {
	cellsRemaining: number;
	completionPercent: number;
};

type GameOverInfo = {
	winnerId: string;
	winnerName: string;
};

type UseMultiplayerOptions = {
	socket: WebSocket;
	playerId: string;
	playerName: string;
};

export function useMultiplayer({
	socket,
	playerId,
	playerName,
}: UseMultiplayerOptions) {
	const [connected, setConnected] = useState(false);
	const [roomState, setRoomState] = useState<RoomState | null>(null);
	const [puzzle, setPuzzle] = useState<string | null>(null);
	const [opponentProgress, setOpponentProgress] =
		useState<OpponentProgress | null>(null);
	const [gameOver, setGameOver] = useState<GameOverInfo | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [opponentDisconnected, setOpponentDisconnected] = useState(false);
	const socketRef = useRef(socket);
	socketRef.current = socket;

	useEffect(() => {
		const ws = socketRef.current;

		const onOpen = () => {
			setConnected(true);
			ws.send(JSON.stringify({ type: "join", name: playerName, playerId }));
		};

		const onMessage = (event: unknown) => {
			const msg = JSON.parse((event as MessageEvent).data) as ServerMessage;
			switch (msg.type) {
				case "room_state":
					setRoomState(msg.state);
					setError(null);
					break;
				case "game_start":
					setPuzzle(msg.puzzle);
					setRoomState((prev) =>
						prev ? { ...prev, status: "playing" } : prev,
					);
					break;
				case "opponent_progress":
					setOpponentProgress({
						cellsRemaining: msg.cellsRemaining,
						completionPercent: msg.completionPercent,
					});
					break;
				case "game_over":
					setGameOver({
						winnerId: msg.winnerId,
						winnerName: msg.winnerName,
					});
					break;
				case "rematch_start":
					setPuzzle(msg.puzzle);
					setGameOver(null);
					setOpponentProgress(null);
					setRoomState((prev) =>
						prev ? { ...prev, status: "playing", winnerId: null } : prev,
					);
					break;
				case "opponent_disconnected":
					setOpponentDisconnected(true);
					break;
				case "opponent_reconnected":
					setOpponentDisconnected(false);
					break;
				case "error":
					setError(msg.message);
					break;
			}
		};

		const onClose = () => {
			setConnected(false);
		};

		ws.addEventListener("open", onOpen);
		ws.addEventListener("message", onMessage);
		ws.addEventListener("close", onClose);

		return () => {
			ws.removeEventListener("open", onOpen);
			ws.removeEventListener("message", onMessage);
			ws.removeEventListener("close", onClose);
		};
	}, [playerId, playerName]);

	const send = useCallback((data: object) => {
		socketRef.current.send(JSON.stringify(data));
	}, []);

	const sendStartGame = useCallback(() => {
		send({ type: "start_game" });
	}, [send]);

	const sendProgress = useCallback(
		(cellsRemaining: number, completionPercent: number) => {
			send({ type: "progress", cellsRemaining, completionPercent });
		},
		[send],
	);

	const sendComplete = useCallback(
		(board: string) => {
			send({ type: "complete", board });
		},
		[send],
	);

	const sendRematch = useCallback(() => {
		send({ type: "rematch" });
	}, [send]);

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
	};
}
