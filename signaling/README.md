# Dokuel Signaling Server

Lightweight Cloudflare Worker that implements the [y-webrtc](https://github.com/yjs/y-webrtc) signaling protocol using Durable Objects. Used only for WebRTC peer discovery — all game data flows peer-to-peer after connection. Also mints ephemeral TURN credentials (`GET /turn-credentials`) so peers behind carrier NAT can fall back to a relay.

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

### 4. TURN relay (Cloudflare Realtime)

STUN-only WebRTC cannot traverse the symmetric NAT / CGNAT used by mobile
carriers — a phone on cellular and a phone on wifi never connect directly.
The worker's `GET /turn-credentials` route fixes this by minting short-lived
(24h) [Cloudflare Realtime TURN](https://developers.cloudflare.com/realtime/turn/)
credentials, so the account API token never ships to browsers.

One-time setup:

1. In the [Cloudflare dashboard](https://dash.cloudflare.com), go to
   **Realtime → TURN Server** and create a TURN key. Note the **Key ID** and
   the **API token** shown at creation.
2. Store both as Worker secrets:

   ```bash
   cd signaling
   bunx wrangler secret put TURN_KEY_ID        # paste the key id
   bunx wrangler secret put TURN_KEY_API_TOKEN # paste the key's api token
   ```

Without these secrets the route returns 404 and clients silently fall back
to STUN-only (same-network play still works). Cloudflare Realtime includes
1,000 GB/month of free TURN egress — the relay only carries traffic when a
direct connection is impossible, and sudoku sync is a few KB per game.

The frontend can still override everything at build time with
`VITE_TURN_URL` / `VITE_TURN_USERNAME` / `VITE_TURN_CREDENTIAL` (static
credentials, e.g. for local testing against coturn).

## Architecture

- **Worker**: Routes all WebSocket connections to a single Durable Object instance
- **Durable Object (`SignalingRoom`)**: Maintains topic→subscribers mapping, forwards messages between peers in the same room
- **Protocol**: JSON messages — `subscribe`, `unsubscribe`, `publish`, `ping`/`pong` (matches y-webrtc expectations)
- **Custom Domain**: `signal.dokuel.com` (WSS handled automatically by Cloudflare)

## Cost

Cloudflare Workers free tier: 100K requests/day, 10ms CPU time/request. The signaling server is extremely lightweight — each multiplayer session only needs a handful of signaling messages for peer discovery.
# Credential issuance limits

`GET /turn-credentials` uses the `TURN_RATE_LIMITER` binding in
`wrangler.toml`: 60 requests per minute for each trusted client IP at each
Cloudflare location. This is an abuse cap, not a global quota; users behind
the same mobile or office NAT share the allowance. The client caches a
successful credential response for its page session.

Limited requests return `429` with `Retry-After: 60`. Missing TURN secrets
still return `404` so the client can use STUN; a missing rate-limit binding
returns `503` instead of minting without the cap. Credential responses use
`Cache-Control: no-store`. The upstream fetch times out after five seconds.

Namespace `2026090501` is reserved here for this binding. Deploy the Worker
configuration together with its source; the limit is not active until then.

Run the HTTP boundary checks with
`bun run test -- signaling/tests/turn-credentials.test.ts` from the repository
root. See [Cloudflare's rate-limit binding documentation](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
for locality and namespace behavior.
