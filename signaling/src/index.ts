/**
 * y-webrtc signaling server as a Cloudflare Worker with Durable Objects.
 *
 * Implements the y-webrtc signaling protocol:
 * - { type: "subscribe", topics: string[] }
 * - { type: "unsubscribe", topics: string[] }
 * - { type: "publish", topic: string, ... }
 * - { type: "ping" } → { type: "pong" }
 */

type Env = {
  SIGNALING_ROOM: DurableObjectNamespace;
  TURN_KEY_ID: string;
  TURN_KEY_API_TOKEN: string;
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
      const id = env.SIGNALING_ROOM.idFromName("global");
      const stub = env.SIGNALING_ROOM.get(id);
      return stub.fetch(request);
    }

    // TURN credentials endpoint
    const url = new URL(request.url);
    if (url.pathname === "/turn-credentials" && request.method === "POST") {
      return handleTurnCredentials(env);
    }

    // Health check (non-WebSocket requests)
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response("ok", { headers: corsHeaders() });
    }

    return new Response("Expected WebSocket", { status: 426 });
  },
};

async function handleTurnCredentials(env: Env): Promise<Response> {
  if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) {
    return new Response(JSON.stringify({ iceServers: [] }), {
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }

  const resp = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl: 86400 }),
    },
  );

  if (!resp.ok) {
    return new Response(JSON.stringify({ iceServers: [] }), {
      status: 502,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }

  const body = await resp.text();
  return new Response(body, {
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

import { DurableObject } from "cloudflare:workers";

// Attachment stored on each WebSocket, survives DO hibernation
type WsAttachment = { topics: string[] };

export class SignalingRoom extends DurableObject {
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
          const attachment = peer.deserializeAttachment() as WsAttachment | null;
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
