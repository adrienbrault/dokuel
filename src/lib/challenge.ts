import type { Challenge, GhostSample } from "./types.ts";

/**
 * Async-challenge artifact codec.
 *
 * A {@link Challenge} is serialized to a compact, URL-safe string so it
 * can travel inside a shareable link with no server: JSON → gzip (via
 * the native `CompressionStream`) → base64url. `decodeChallenge` is the
 * exact inverse and never throws — a malformed or outdated blob yields
 * `null`.
 *
 * The transport seam is {@link buildChallengeUrl} / {@link
 * parseChallengeUrl}: today the blob lives in the URL hash; a future
 * server would store the artifact behind a short id and only those two
 * functions would change — the `Challenge` model and this codec stay put.
 */

const DIFFICULTIES = new Set(["easy", "medium", "hard", "expert"]);
const ASSIST_LEVELS = new Set(["paper", "standard", "full"]);

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  let length = 0;
  for (const chunk of chunks) length += chunk.length;
  const out = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

async function pumpStream(
  stream: ReadableStream<Uint8Array>,
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let result = await reader.read();
  while (!result.done) {
    chunks.push(result.value);
    result = await reader.read();
  }
  return concatBytes(chunks);
}

async function streamThrough(
  stream: {
    readable: ReadableStream<Uint8Array>;
    writable: WritableStream<BufferSource>;
  },
  input: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  // A failing transform (e.g. non-gzip input) rejects these promises;
  // the same failure also surfaces on the readable side where the
  // caller handles it, so swallow them to avoid an unhandled rejection.
  writer.write(input).catch(() => {});
  writer.close().catch(() => {});
  return pumpStream(stream.readable);
}

async function gzip(text: string): Promise<Uint8Array> {
  return streamThrough(
    new CompressionStream("gzip"),
    new TextEncoder().encode(text),
  );
}

async function gunzip(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  return new TextDecoder().decode(
    await streamThrough(new DecompressionStream("gzip"), bytes),
  );
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function isValidChallenge(data: unknown): data is Challenge {
  if (typeof data !== "object" || data === null) return false;
  const c = data as Record<string, unknown>;
  if (c.v !== 1) return false;
  if (typeof c.puzzle !== "string" || c.puzzle.length !== 81) return false;
  if (typeof c.difficulty !== "string" || !DIFFICULTIES.has(c.difficulty)) {
    return false;
  }
  if (typeof c.assistLevel !== "string" || !ASSIST_LEVELS.has(c.assistLevel)) {
    return false;
  }
  if (typeof c.challengerName !== "string") return false;
  if (typeof c.finalTime !== "number" || !Number.isFinite(c.finalTime)) {
    return false;
  }
  if (typeof c.hintsUsed !== "number" || !Number.isFinite(c.hintsUsed)) {
    return false;
  }
  if (!Array.isArray(c.ghost) || c.ghost.length === 0) return false;
  for (const sample of c.ghost) {
    if (typeof sample !== "object" || sample === null) return false;
    const s = sample as Record<string, unknown>;
    if (typeof s.t !== "number" || typeof s.p !== "number") return false;
  }
  return true;
}

/**
 * The ghost's completion percent at elapsed time `t` (seconds), linearly
 * interpolated between the two bracketing samples. Clamps to the
 * endpoints outside the recorded range — before the first sample and at
 * or after the last. `samples` is assumed non-empty and monotonic, as
 * produced by the recorder.
 */
export function ghostPercentAt(samples: GhostSample[], t: number): number {
  const first = samples[0];
  if (!first) return 0;
  if (t <= first.t) return first.p;
  const last = samples[samples.length - 1]!;
  if (t >= last.t) return last.p;
  for (let i = 1; i < samples.length; i++) {
    const b = samples[i]!;
    if (t < b.t) {
      const a = samples[i - 1]!;
      const span = b.t - a.t;
      if (span <= 0) return b.p;
      return Math.round(a.p + ((b.p - a.p) * (t - a.t)) / span);
    }
  }
  return last.p;
}

/** Serialize a challenge to a compact, URL-safe blob string. */
export async function encodeChallenge(challenge: Challenge): Promise<string> {
  const compressed = await gzip(JSON.stringify(challenge));
  return bytesToBase64Url(compressed);
}

/**
 * Inverse of {@link encodeChallenge}. Returns `null` (never throws) for
 * any malformed input: bad base64url, bad gzip, bad JSON, an unknown
 * schema version, or a structurally invalid artifact.
 */
export async function decodeChallenge(blob: string): Promise<Challenge | null> {
  try {
    const json = await gunzip(base64UrlToBytes(blob));
    const data: unknown = JSON.parse(json);
    return isValidChallenge(data) ? data : null;
  } catch {
    return null;
  }
}

const CHALLENGE_PATH = "/challenge";

/**
 * Build a shareable challenge link. The artifact rides in the URL hash,
 * so it never reaches a server. This is the transport seam: a future
 * server would store the artifact and hand back a short id here, while
 * the Challenge model and the codec above stay untouched.
 */
export async function buildChallengeUrl(challenge: Challenge): Promise<string> {
  const blob = await encodeChallenge(challenge);
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://dokuel.com";
  return `${origin}${CHALLENGE_PATH}#${blob}`;
}

/**
 * Extract a Challenge from a location. Returns `null` when the path is
 * not the challenge route, the hash is empty, or the blob is undecodable.
 */
export async function parseChallengeUrl(loc: {
  pathname: string;
  hash: string;
}): Promise<Challenge | null> {
  if (loc.pathname.replace(/^\/+|\/+$/g, "") !== "challenge") return null;
  const blob = loc.hash.replace(/^#/, "");
  if (!blob) return null;
  return decodeChallenge(blob);
}

/**
 * Build a challenge link and hand it to the user: the native share
 * sheet when available, otherwise the clipboard.
 */
export async function shareChallenge(challenge: Challenge): Promise<void> {
  const url = await buildChallengeUrl(challenge);
  if (navigator.share) {
    try {
      await navigator.share({ url, title: "Dokuel — beat my time!" });
      return;
    } catch {
      // cancelled or unsupported — fall through to clipboard
    }
  }
  await navigator.clipboard?.writeText(url);
}
