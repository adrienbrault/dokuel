import { SIGNALING_URL } from "./constants.ts";

type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

type TurnCredentialsResponse = {
  iceServers: IceServer[];
};

const SIGNALING_HTTP_URL = SIGNALING_URL.replace("wss://", "https://");

const DEFAULT_ICE_SERVERS: IceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  // biome-ignore lint/security/noSecrets: STUN server URL, not a secret
  { urls: "stun:global.stun.twilio.com:3478?transport=udp" },
];

export async function fetchIceServers(): Promise<IceServer[]> {
  try {
    const resp = await fetch(`${SIGNALING_HTTP_URL}/turn-credentials`, {
      method: "POST",
    });
    if (!resp.ok) return DEFAULT_ICE_SERVERS;

    const data: TurnCredentialsResponse = await resp.json();
    if (!data.iceServers || data.iceServers.length === 0) {
      return DEFAULT_ICE_SERVERS;
    }
    return data.iceServers;
  } catch {
    return DEFAULT_ICE_SERVERS;
  }
}
