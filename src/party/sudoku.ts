import type { Connection, ConnectionContext, Party } from "partykit/server";
import type { ClientMessage } from "../lib/types.ts";
import type { OutgoingMessage } from "./room.ts";
import { GameRoom } from "./room.ts";

const playerConnections = new Map<string, Connection>();

export default class SudokuServer {
	room: GameRoom;
	party: Party;

	constructor(party: Party) {
		this.party = party;
		this.room = new GameRoom(party.id);
	}

	onConnect(_conn: Connection, _ctx: ConnectionContext) {
		// Connection established, wait for join message
	}

	onMessage(message: string, sender: Connection) {
		let msg: ClientMessage;
		try {
			msg = JSON.parse(message);
		} catch {
			sender.send(
				JSON.stringify({ type: "error", message: "Invalid message" }),
			);
			return;
		}

		// Track connection by playerId on join
		if (msg.type === "join") {
			playerConnections.set(msg.playerId, sender);
		}

		const senderId = this.getPlayerId(sender);
		if (!senderId && msg.type !== "join") {
			sender.send(JSON.stringify({ type: "error", message: "Not joined" }));
			return;
		}

		const outgoing = this.room.handleMessage(
			msg.type === "join" ? msg.playerId : senderId!,
			msg,
		);
		this.dispatch(outgoing, sender, senderId);
	}

	onClose(conn: Connection) {
		const playerId = this.getPlayerId(conn);
		if (!playerId) return;
		const outgoing = this.room.handleDisconnect(playerId);
		this.dispatch(outgoing, conn, playerId);
	}

	private getPlayerId(conn: Connection): string | null {
		for (const [id, c] of playerConnections) {
			if (c === conn) return id;
		}
		return null;
	}

	private getOpponentConnection(senderId: string): Connection | null {
		for (const [id, conn] of playerConnections) {
			if (id !== senderId) return conn;
		}
		return null;
	}

	private dispatch(
		messages: OutgoingMessage[],
		sender: Connection,
		senderId: string | null,
	) {
		for (const { target, message } of messages) {
			const json = JSON.stringify(message);
			switch (target) {
				case "sender":
					sender.send(json);
					break;
				case "opponent": {
					if (senderId) {
						const opponent = this.getOpponentConnection(senderId);
						opponent?.send(json);
					}
					break;
				}
				case "all":
					this.party.broadcast(json);
					break;
			}
		}
	}
}
