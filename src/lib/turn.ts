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

export async function fetchTurnIceServers(): Promise<RTCIceServer[] | null> {
  return null;
}
