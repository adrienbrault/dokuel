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

type EventRecord = Record<string, unknown>;

function toDataPoint(
  sid: string,
  event: EventRecord,
): AnalyticsEngineDataPoint {
  const name = event.name as string;
  const spec = EVENT_SPECS[name] as EventSpec;
  return {
    indexes: [name],
    blobs: [
      name,
      sid,
      ...Object.keys(spec.strings).map((field) => event[field] as string),
    ],
    doubles: spec.numbers.map((field) => event[field] as number),
  };
}

export async function handleEvents(
  request: Request,
  env: EventsEnv,
): Promise<Response> {
  const body = JSON.parse(await request.text()) as {
    sid: string;
    events: EventRecord[];
  };
  for (const event of body.events) {
    env.EVENTS?.writeDataPoint(toDataPoint(body.sid, event));
  }
  return new Response(null, { status: 204 });
}
