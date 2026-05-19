/**
 * Lightweight self-diagnostic for the iOS Safari reload problem.
 * Counts how many times the multiplayer hook has mounted for a given
 * room in the last hour. A user (or someone debugging via Safari Web
 * Inspector) can see whether the mitigations are reducing reload
 * frequency without needing remote telemetry infrastructure.
 */

const KEY_PREFIX = "dokuel_mp_reloads_";
const WINDOW_MS = 60 * 60 * 1000;

function key(roomId: string): string {
  return KEY_PREFIX + roomId;
}

export function recordRoomMount(roomId: string, now = Date.now()): number {
  let entries: number[] = [];
  try {
    const raw = localStorage.getItem(key(roomId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        entries = parsed.filter(
          (t): t is number => typeof t === "number" && now - t <= WINDOW_MS,
        );
      }
    }
  } catch {
    // Quota or malformed JSON — reset.
  }
  entries.push(now);
  try {
    localStorage.setItem(key(roomId), JSON.stringify(entries));
  } catch {
    // Quota exceeded — best-effort only.
  }
  return entries.length;
}
