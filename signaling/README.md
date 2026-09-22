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

### 5. Telemetry (Workers Analytics Engine)

`POST /events` takes anonymous batches of error reports and multiplayer
connection events from deployed app builds (see the Telemetry section of
`spec.md`) and writes each event to the `dokuel_events` Analytics Engine
dataset through the `EVENTS` binding in `wrangler.toml`.

One-time setup: in the Cloudflare dashboard, open **Workers & Pages →
Analytics Engine** and enable it for the account. The dataset is created
on the first write; nothing else is needed. Without the binding the route
still answers 204 and drops the events, so `wrangler dev` works as is.

Validation is strict (`src/events.ts`): known event names only, known
fields only, bounded strings, at most 25 events and 32 KB per request;
anything else is a 400 and nothing is written. Column layout per row:

| Column | Content |
|--------|---------|
| `index1`, `blob1` | event name |
| `blob2` | random per-page-load session id |
| `blob3`... | the event's string fields, in `EVENT_SPECS` order |
| `double1`... | the event's number fields, in `EVENT_SPECS` order |

| Event | Strings (blob3...) | Numbers (double1...) |
|-------|--------------------|----------------------|
| `error` | source, message, stack, path | |
| `mp_room_mount` | | count |
| `mp_ice_servers` | source | ms |
| `mp_first_peer` | | ms |
| `mp_ice_route` | local, remote | |
| `mp_connect_failed` | reason, role | ms |

Query with the [SQL API](https://developers.cloudflare.com/analytics/analytics-engine/sql-api/),
for example the connect failure reasons over the last week:

```sql
SELECT blob3 AS reason, blob4 AS role, SUM(_sample_interval) AS failures
FROM dokuel_events
WHERE index1 = 'mp_connect_failed' AND timestamp > NOW() - INTERVAL '7' DAY
GROUP BY reason, role
```

To point a local app build at `wrangler dev`, build it with
`VITE_TELEMETRY_URL=http://localhost:8787/events`; `VITE_TELEMETRY_URL=off`
disables telemetry in a deployed build.

## Architecture

- **Worker**: Routes all WebSocket connections to a single Durable Object instance
- **Durable Object (`SignalingRoom`)**: Maintains topic→subscribers mapping, forwards messages between peers in the same room
- **Protocol**: JSON messages — `subscribe`, `unsubscribe`, `publish`, `ping`/`pong` (matches y-webrtc expectations)
- **Custom Domain**: `signal.dokuel.com` (WSS handled automatically by Cloudflare)

## Cost

Cloudflare Workers free tier: 100K requests/day, 10ms CPU time/request. The signaling server is extremely lightweight — each multiplayer session only needs a handful of signaling messages for peer discovery.
