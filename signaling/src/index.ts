/**
 * y-webrtc signaling server as a Cloudflare Worker with Durable Objects.
 *
 * Implements the y-webrtc signaling protocol:
 * - { type: "subscribe", topics: string[] }
 * - { type: "unsubscribe", topics: string[] }
 * - { type: "publish", topic: string, ... }
 * - { type: "ping" } → { type: "pong" }
 *
 * Rooms are sharded: the client appends its room id to the URL path
 * (wss://signal.dokuel.com/<roomId>) and each path maps to its own
 * Durable Object, so one room's fanout never scans another room's
 * sockets. A bare path keeps the legacy shared "global" object so
 * clients built before the sharding still connect.
 */

import { DurableObject } from "cloudflare:workers";

const MAX_ROOM_KEY_LENGTH = 64;

type Env = {
  SIGNALING_ROOM: DurableObjectNamespace;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders(),
      });
    }

    // WebSocket upgrade
    if (request.headers.get("Upgrade") === "websocket") {
      const url = new URL(request.url);
      const roomKey =
        url.pathname.slice(1).slice(0, MAX_ROOM_KEY_LENGTH) || "global";
      const id = env.SIGNALING_ROOM.idFromName(roomKey);
      const stub = env.SIGNALING_ROOM.get(id);
      return stub.fetch(request);
    }

    // Health check (non-WebSocket requests)
    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response("ok", { headers: corsHeaders() });
    }

    return new Response("Expected WebSocket", { status: 426 });
  },
};

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

// Attachment stored on each WebSocket, survives DO hibernation
type WsAttachment = { topics: string[] };

export class SignalingRoom extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // y-webrtc keepalive pings answered by the runtime itself, without
    // waking a hibernated object — the previous in-handler pong meant
    // every idle client resurrected the DO every ~30s, defeating
    // hibernation entirely.
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('{"type":"ping"}', '{"type":"pong"}'),
    );
  }

  async fetch(request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ topics: [] } satisfies WsAttachment);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer) {
    if (typeof data !== "string") return;

    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

    switch (msg.type) {
      case "subscribe": {
        const topics = msg.topics as string[] | undefined;
        if (!Array.isArray(topics)) return;
        const attachment = ws.deserializeAttachment() as WsAttachment;
        const updated = new Set([...attachment.topics, ...topics]);
        ws.serializeAttachment({ topics: [...updated] } satisfies WsAttachment);
        break;
      }
      case "unsubscribe": {
        const topics = msg.topics as string[] | undefined;
        if (!Array.isArray(topics)) return;
        const attachment = ws.deserializeAttachment() as WsAttachment;
        const updated = attachment.topics.filter((t) => !topics.includes(t));
        ws.serializeAttachment({ topics: updated } satisfies WsAttachment);
        break;
      }
      case "publish": {
        const topic = msg.topic as string | undefined;
        if (!topic) return;
        // Forward to all other clients subscribed to this topic
        for (const peer of this.ctx.getWebSockets()) {
          if (peer === ws) continue;
          const attachment =
            peer.deserializeAttachment() as WsAttachment | null;
          if (attachment?.topics.includes(topic)) {
            try {
              peer.send(data);
            } catch {
              // Client disconnected
            }
          }
        }
        break;
      }
      case "ping": {
        // Fallback for ping payloads that don't byte-match the
        // auto-response pair (e.g. different whitespace).
        try {
          ws.send(JSON.stringify({ type: "pong" }));
        } catch {
          // ignore
        }
        break;
      }
    }
  }

  async webSocketClose(_ws: WebSocket) {}
  async webSocketError(_ws: WebSocket) {}
}
