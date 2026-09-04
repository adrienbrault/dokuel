import { readJson, writeJson } from "./storage.ts";

export const PRODUCT_EVENTS = [
  "visit",
  "game_start",
  "game_complete",
  "game_abandon",
  "invite_share",
  "challenge_open",
  "receipt_share",
  "receipt_open",
  "repeat_pair",
  "interest_quick",
  "interest_cosmetics",
  "interest_collections",
  "interest_learning",
] as const;
export type ProductEvent = (typeof PRODUCT_EVENTS)[number];
export type ProductMode = "solo" | "daily" | "friend" | "live";
const CONSENT_KEY = "dokuel_measurement_consent";

export function getMeasurementConsent(): boolean {
  return readJson(CONSENT_KEY, false, (value) => value === true) === true;
}

export function setMeasurementConsent(enabled: boolean): boolean {
  return writeJson(CONSENT_KEY, enabled);
}

/** No queue, identifiers, path, puzzle, precise duration, or historical replay. */
export function trackProductEvent(
  event: ProductEvent,
  mode: ProductMode = "solo",
  durationSeconds = 0,
): void {
  if (!getMeasurementConsent()) return;
  const minutes = Number.isFinite(durationSeconds)
    ? Math.min(240, Math.max(0, Math.floor(durationSeconds / 60)))
    : 0;
  void fetch("https://signal.dokuel.com/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version: 1, event, mode, minutes }),
    credentials: "omit",
    referrerPolicy: "no-referrer",
    keepalive: true,
  }).catch(() => {});
}
