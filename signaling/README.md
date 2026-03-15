# Dokuel Signaling Server

Lightweight Cloudflare Worker that implements the [y-webrtc](https://github.com/yjs/y-webrtc) signaling protocol using Durable Objects. Used only for WebRTC peer discovery — all game data flows peer-to-peer after connection.

## Setup

### 1. GitHub Secrets

Add these secrets to the repository (`Settings → Secrets and variables → Actions`):

| Secret | Description | How to get it |
|--------|-------------|---------------|
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID | [Cloudflare dashboard](https://dash.cloudflare.com) → any zone → Overview → right sidebar |
| `CLOUDFLARE_API_TOKEN` | API token with Workers permissions | [API Tokens](https://dash.cloudflare.com/profile/api-tokens) → Create Token → "Edit Cloudflare Workers" template |

The API token needs these permissions:
- **Account / Workers Scripts / Edit**
- **Account / Workers Routes / Edit**
- **Account / Durable Objects / Edit** (included in Workers Scripts)
- **Zone / Zone / Read** (needed for custom domain routing)
- **Zone / DNS / Edit** (needed for custom domain DNS records)
- **Zone / Workers Routes / Edit** (needed for custom domain routing)

Easiest approach: start from the "Edit Cloudflare Workers" template, then add the three Zone permissions above (scope to `dokuel.com` zone or all zones).

### 2. DNS

The Worker uses a [Custom Domain](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/) (`signal.dokuel.com`). Cloudflare handles DNS automatically when deploying — no manual DNS record needed.

### 3. Deploy

Deployment happens automatically via GitHub Actions on push to `main` when files in `signaling/` change. You can also trigger manually from the Actions tab (`workflow_dispatch`).

For first-time or manual deploy:

```bash
cd signaling
bun install
bunx wrangler login
bunx wrangler deploy
```

### 4. TURN Relay (for NAT traversal)

WebRTC peer-to-peer connections fail on restrictive networks (4G/mobile, corporate firewalls) where symmetric NAT blocks direct connections. A TURN relay server acts as a fallback — peers relay traffic through it when they can't connect directly.

#### Setup

1. **Create a TURN key** in the [Cloudflare dashboard](https://dash.cloudflare.com) → Calls/Realtime → TURN Keys → Create
2. **Add Worker secrets** (the TURN key ID and API token):
   ```bash
   cd signaling
   bunx wrangler secret put TURN_KEY_ID
   bunx wrangler secret put TURN_KEY_API_TOKEN
   ```
3. **Deploy** — the signaling worker already has a `/turn-credentials` endpoint that generates short-lived TURN credentials using the Cloudflare TURN API. The client fetches these before establishing a WebRTC connection.

Without these secrets, the worker returns an empty `iceServers` array and the client falls back to STUN-only (direct connections only, no relay).

#### Cost

Cloudflare TURN: $0.05/GB of relayed data. Sudoku CRDT sync is tiny — a typical game relays kilobytes, not megabytes.

## Architecture

- **Worker**: Routes all WebSocket connections to a single Durable Object instance
- **Durable Object (`SignalingRoom`)**: Maintains topic→subscribers mapping, forwards messages between peers in the same room
- **Protocol**: JSON messages — `subscribe`, `unsubscribe`, `publish`, `ping`/`pong` (matches y-webrtc expectations)
- **Custom Domain**: `signal.dokuel.com` (WSS handled automatically by Cloudflare)

## Cost

Cloudflare Workers free tier: 100K requests/day, 10ms CPU time/request. The signaling server is extremely lightweight — each multiplayer session only needs a handful of signaling messages for peer discovery.
