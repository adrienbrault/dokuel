import { Agent, type Connection, routeAgentRequest } from "agents";
import type { ClientMessage } from "../lib/types.ts";
import type { OutgoingMessage } from "./room.ts";
import { GameRoom } from "./room.ts";

export class SudokuAgent extends Agent {
  room!: GameRoom;

  onStart() {
    this.room = new GameRoom(this.name);
  }

  onConnect(_connection: Connection) {
    // Connection established, wait for join message
  }

  onMessage(connection: Connection, message: string | ArrayBuffer) {
    if (typeof message !== "string") return;

    let msg: ClientMessage;
    try {
      msg = JSON.parse(message);
    } catch {
      connection.send(
        JSON.stringify({ type: "error", message: "Invalid message" }),
      );
      return;
    }

    // Track connection by playerId on join
    if (msg.type === "join") {
      connection.setState({ playerId: msg.playerId });
    }

    const state = connection.state as { playerId?: string } | undefined;
    const senderId = state?.playerId ?? null;
    if (!senderId && msg.type !== "join") {
      connection.send(JSON.stringify({ type: "error", message: "Not joined" }));
      return;
    }

    const outgoing = this.room.handleMessage(
      msg.type === "join" ? msg.playerId : senderId!,
      msg,
    );
    this.dispatch(outgoing, connection, senderId);
  }

  onClose(connection: Connection) {
    const state = connection.state as { playerId?: string } | undefined;
    const playerId = state?.playerId ?? null;
    if (!playerId) return;
    const outgoing = this.room.handleDisconnect(playerId);
    this.dispatch(outgoing, connection, playerId);
  }

  private getOpponentConnection(senderId: string): Connection | null {
    for (const conn of this.getConnections()) {
      const state = conn.state as { playerId?: string } | undefined;
      if (state?.playerId && state.playerId !== senderId) return conn;
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
          this.broadcast(json);
          break;
      }
    }
  }
}

export default {
  async fetch(request: Request, env: unknown) {
    return (
      (await routeAgentRequest(request, env)) ??
      new Response("Not found", { status: 404 })
    );
  },
};
