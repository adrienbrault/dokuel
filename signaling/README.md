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

### 2. DNS

The Worker uses a [Custom Domain](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/) (`signal.dokuel.com`). Cloudflare handles DNS automatically when deploying — no manual DNS record needed.

### 3. Deploy

Deployment happens automatically via GitHub Actions on push to `main` when files in `signaling/` change. You can also trigger manually from the Actions tab (`workflow_dispatch`).

For first-time or manual deploy:

```bash
cd signaling
npm install
npx wrangler login
npx wrangler deploy
```

## Architecture

- **Worker**: Routes all WebSocket connections to a single Durable Object instance
- **Durable Object (`SignalingRoom`)**: Maintains topic→subscribers mapping, forwards messages between peers in the same room
- **Protocol**: JSON messages — `subscribe`, `unsubscribe`, `publish`, `ping`/`pong` (matches y-webrtc expectations)
- **Custom Domain**: `signal.dokuel.com` (WSS handled automatically by Cloudflare)

## Cost

Cloudflare Workers free tier: 100K requests/day, 10ms CPU time/request. The signaling server is extremely lightweight — each multiplayer session only needs a handful of signaling messages for peer discovery.
