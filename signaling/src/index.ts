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
import { collectProductEvent, type ProductEnvironment } from "./product-events";
import {
  generateTurnCredentials,
  type TurnEnvironment,
} from "./turn-credentials";

const MAX_ROOM_KEY_LENGTH = 64;

// Abuse caps. y-webrtc signaling frames are small JSON (SDP offers top
// out around a few KB); topics are room names.
const MAX_MESSAGE_CHARS = 65_536;
const MAX_TOPICS_PER_SOCKET = 16;
const MAX_TOPIC_LENGTH = 256;

// Browsers always send Origin on WebSocket upgrades; this is abuse
// mitigation (stops third-party sites from borrowing the server), not
// authentication.
const ALLOWED_ORIGINS = new Set([
  "https://dokuel.com",
  "https://sudoku-4cc.pages.dev",
]);

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  // Cloudflare Pages preview deployments
  if (
    url.protocol === "https:" &&
    url.hostname.endsWith(".sudoku-4cc.pages.dev")
  ) {
    return true;
  }
  // Local development
  return url.hostname === "localhost" || url.hostname === "127.0.0.1";
}

type Env = TurnEnvironment &
  ProductEnvironment & {
    SIGNALING_ROOM: DurableObjectNamespace;
    // Cloudflare Realtime TURN key — set via `wrangler secret put`. Both
    // optional: without them /turn-credentials 404s and clients fall
    // back to STUN-only.
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
      if (!isAllowedOrigin(request.headers.get("Origin"))) {
        return new Response("Forbidden", { status: 403 });
      }
      const url = new URL(request.url);
      const roomKey =
        url.pathname.slice(1).slice(0, MAX_ROOM_KEY_LENGTH) || "global";
      const id = env.SIGNALING_ROOM.idFromName(roomKey);
      const stub = env.SIGNALING_ROOM.get(id);
      return stub.fetch(request);
    }

    const url = new URL(request.url);

    if (url.pathname === "/events") {
      if (!isAllowedOrigin(request.headers.get("Origin")))
        return new Response("Forbidden", { status: 403 });
      return collectProductEvent(request, env);
    }

    // Ephemeral TURN credentials for WebRTC NAT traversal. Same
    // origin gate as the WebSocket upgrade: abuse mitigation, not
    // authentication — the credentials themselves expire.
    if (url.pathname === "/turn-credentials") {
      if (!isAllowedOrigin(request.headers.get("Origin"))) {
        return new Response("Forbidden", { status: 403 });
      }
      return generateTurnCredentials(request, env);
    }

    // Health check (non-WebSocket requests)
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response("ok", { headers: corsHeaders() });
    }

    return new Response("Expected WebSocket", { status: 426 });
  },
};

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
    if (typeof data !== "string" || data.length > MAX_MESSAGE_CHARS) return;

    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

    switch (msg.type) {
      case "subscribe":
        this.subscribe(ws, msg.topics);
        break;
      case "unsubscribe":
        this.unsubscribe(ws, msg.topics);
        break;
      case "publish":
        this.publish(ws, msg.topic, data);
        break;
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

  /** Sanitize a client-supplied topic list: strings only, bounded
   *  length — attachments are capped at 2 KiB serialized, so unbounded
   *  topics would throw on serializeAttachment. */
  private sanitizeTopics(raw: unknown): string[] | null {
    if (!Array.isArray(raw)) return null;
    return raw.filter(
      (t): t is string =>
        typeof t === "string" && t.length > 0 && t.length <= MAX_TOPIC_LENGTH,
    );
  }

  private subscribe(ws: WebSocket, rawTopics: unknown): void {
    const topics = this.sanitizeTopics(rawTopics);
    if (!topics) return;
    const attachment = ws.deserializeAttachment() as WsAttachment;
    const updated = [...new Set([...attachment.topics, ...topics])].slice(
      0,
      MAX_TOPICS_PER_SOCKET,
    );
    ws.serializeAttachment({ topics: updated } satisfies WsAttachment);
  }

  private unsubscribe(ws: WebSocket, rawTopics: unknown): void {
    const topics = this.sanitizeTopics(rawTopics);
    if (!topics) return;
    const attachment = ws.deserializeAttachment() as WsAttachment;
    const updated = attachment.topics.filter((t) => !topics.includes(t));
    ws.serializeAttachment({ topics: updated } satisfies WsAttachment);
  }

  private publish(ws: WebSocket, topic: unknown, data: string): void {
    if (typeof topic !== "string" || topic.length > MAX_TOPIC_LENGTH) return;
    // Forward to all other clients subscribed to this topic
    for (const peer of this.ctx.getWebSockets()) {
      if (peer === ws) continue;
      const attachment = peer.deserializeAttachment() as WsAttachment | null;
      if (attachment?.topics.includes(topic)) {
        try {
          peer.send(data);
        } catch {
          // Client disconnected
        }
      }
    }
  }

  async webSocketClose(_ws: WebSocket) {}
  async webSocketError(_ws: WebSocket) {}
}
