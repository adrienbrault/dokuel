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

export async function fetchTurnIceServers(): Promise<RTCIceServer[] | null> {
  const response = await fetch(TURN_CREDENTIALS_URL, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const body = (await response.json()) as { iceServers: RTCIceServer[] };
  return body.iceServers;
}
