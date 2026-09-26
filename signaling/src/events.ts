/**
 * Anonymous client telemetry: error reports and multiplayer connection
 * events, batched by the app and written to Workers Analytics Engine.
 *
 * Every event name has a fixed field list, so a data point's columns
 * mean the same thing for every row of that event:
 *
 * - index1 / blob1: event name
 * - blob2: random per-page-load session id (no IPs, no player names)
 * - blob3..: the event's string fields, in EVENT_SPECS order
 * - double1..: the event's number fields, in EVENT_SPECS order
 *
 * The client mirrors these specs in src/lib/telemetry.ts; the worker
 * compiles under its own tsconfig, so they are duplicated rather than
 * shared (same trade-off as MAX_ROOM_KEY_LENGTH).
 */

export type EventsEnv = { EVENTS?: AnalyticsEngineDataset };

type EventSpec = {
  /** String field name to its maximum length. */
  strings: Record<string, number>;
  numbers: string[];
};

const EVENT_SPECS: Record<string, EventSpec> = {
  error: {
    strings: { source: 16, message: 300, stack: 2000, path: 100 },
    numbers: [],
  },
  mp_room_mount: { strings: {}, numbers: ["count"] },
  mp_ice_servers: { strings: { source: 16 }, numbers: ["ms"] },
  mp_first_peer: { strings: {}, numbers: ["ms"] },
  mp_ice_route: { strings: { local: 16, remote: 16 }, numbers: [] },
  mp_connect_failed: {
    strings: { reason: 64, role: 16 },
    numbers: ["ms"],
  },
};

// Abuse caps. The client flushes at most 20 events at a time; the
// heaviest event (an error with a stack) stays under 3 KB.
const MAX_BODY_CHARS = 32_768;
const MAX_EVENTS_PER_BATCH = 25;
const SESSION_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** A validated event, its fields already in column order. */
type ValidEvent = { name: string; strings: string[]; numbers: number[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKnownFields(
  raw: Record<string, unknown>,
  spec: EventSpec,
): boolean {
  return Object.keys(raw).every(
    (field) =>
      field === "name" ||
      Object.hasOwn(spec.strings, field) ||
      spec.numbers.includes(field),
  );
}

/**
 * Missing fields are allowed and default to "" / 0, so a client can
 * leave out what it does not know; unknown fields, wrong types and
 * over-long strings are not.
 */
function parseEvent(raw: unknown): ValidEvent | null {
  if (!isRecord(raw) || typeof raw.name !== "string") return null;
  if (!Object.hasOwn(EVENT_SPECS, raw.name)) return null;
  const spec = EVENT_SPECS[raw.name] as EventSpec;
  if (!hasOnlyKnownFields(raw, spec)) return null;

  const strings = Object.entries(spec.strings).map(([field, maxLength]) => {
    const value = Object.hasOwn(raw, field) ? raw[field] : "";
    return typeof value === "string" && value.length <= maxLength
      ? value
      : null;
  });
  const numbers = spec.numbers.map((field) => {
    const value = Object.hasOwn(raw, field) ? raw[field] : 0;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  });
  if (strings.includes(null) || numbers.includes(null)) return null;
  return {
    name: raw.name,
    strings: strings as string[],
    numbers: numbers as number[],
  };
}

/** Parse a whole batch, or null if any part of it is off-schema. */
export function parseEventBatch(
  text: string,
): { sid: string; events: ValidEvent[] } | null {
  if (text.length > MAX_BODY_CHARS) return null;
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(body)) return null;
  const { sid, events } = body;
  if (typeof sid !== "string" || !SESSION_ID_RE.test(sid)) return null;
  if (!Array.isArray(events)) return null;
  if (events.length === 0 || events.length > MAX_EVENTS_PER_BATCH) return null;

  const parsed: ValidEvent[] = [];
  for (const raw of events) {
    const event = parseEvent(raw);
    if (!event) return null;
    parsed.push(event);
  }
  return { sid, events: parsed };
}

function toDataPoint(sid: string, event: ValidEvent): AnalyticsEngineDataPoint {
  return {
    indexes: [event.name],
    blobs: [event.name, sid, ...event.strings],
    doubles: event.numbers,
  };
}

export async function handleEvents(
  request: Request,
  env: EventsEnv,
): Promise<Response> {
  const batch = parseEventBatch(await request.text());
  if (!batch) return new Response("Invalid event batch", { status: 400 });
  for (const event of batch.events) {
    env.EVENTS?.writeDataPoint(toDataPoint(batch.sid, event));
  }
  return new Response(null, { status: 204 });
}
