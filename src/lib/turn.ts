/**
 * Ephemeral TURN credentials for WebRTC NAT traversal.
 *
 * The signaling worker mints short-lived Cloudflare Realtime TURN
 * credentials (see signaling/src/index.ts) so nothing secret ships in
 * the client bundle. STUN-only WebRTC cannot cross the symmetric NAT
 * used by mobile carriers, so without a relay a phone on cellular and
 * a phone on wifi never connect.
 */

export const TURN_CREDENTIALS_URL =
  "https://signal.dokuel.com/turn-credentials";

// Bound the wait: joining a room blocks on this resolution, and a
// slow/broken endpoint must degrade to STUN-only, not a hung lobby.
const FETCH_TIMEOUT_MS = 3_000;

// Successful mints are cached for the page session: credentials live
// 24h, far beyond any session, and the hook re-mounts on every room
// navigation. Failures are NOT cached — a transient outage at first
// join shouldn't doom every later join to STUN-only.
let cachedIceServers: RTCIceServer[] | null = null;

/** Test-only: drop the cached credentials between test cases. */
export function resetTurnCredentialsCache(): void {
  cachedIceServers = null;
}

export async function fetchTurnIceServers(): Promise<RTCIceServer[] | null> {
  if (cachedIceServers) return cachedIceServers;
  try {
    const response = await fetch(TURN_CREDENTIALS_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { iceServers?: unknown };
    if (!Array.isArray(body.iceServers)) return null;
    cachedIceServers = body.iceServers as RTCIceServer[];
    return cachedIceServers;
  } catch {
    return null;
  }
}
