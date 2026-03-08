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
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders(),
      });
    }

    // Health check
    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response("ok", { headers: corsHeaders() });
    }

    // WebSocket upgrade
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    // Route all connections to a single Durable Object instance
    // (the DO handles topic-based routing internally)
    const id = env.SIGNALING_ROOM.idFromName("global");
    const stub = env.SIGNALING_ROOM.get(id);
    return stub.fetch(request);
  },
};

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

type ClientState = {
  topics: Set<string>;
};

export class SignalingRoom {
  private state: DurableObjectState;
  private clients: Map<WebSocket, ClientState> = new Map();

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    this.state.acceptWebSocket(server);
    this.clients.set(server, { topics: new Set() });

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

    const client = this.clients.get(ws);
    if (!client) return;

    switch (msg.type) {
      case "subscribe": {
        const topics = msg.topics as string[] | undefined;
        if (!Array.isArray(topics)) return;
        for (const topic of topics) {
          client.topics.add(topic);
        }
        break;
      }
      case "unsubscribe": {
        const topics = msg.topics as string[] | undefined;
        if (!Array.isArray(topics)) return;
        for (const topic of topics) {
          client.topics.delete(topic);
        }
        break;
      }
      case "publish": {
        const topic = msg.topic as string | undefined;
        if (!topic) return;
        // Forward to all other clients subscribed to this topic
        for (const [peer, peerState] of this.clients) {
          if (peer !== ws && peerState.topics.has(topic)) {
            try {
              peer.send(data);
            } catch {
              // Client disconnected, will be cleaned up in webSocketClose
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

  async webSocketClose(ws: WebSocket) {
    this.clients.delete(ws);
  }

  async webSocketError(ws: WebSocket) {
    this.clients.delete(ws);
  }
}
