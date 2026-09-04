const EVENTS = new Set([
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
]);
const MODES = new Set(["solo", "daily", "friend", "live"]);
export type ProductEnvironment = {
  PRODUCT_ANALYTICS?: {
    writeDataPoint(point: { blobs: string[]; doubles: number[] }): void;
  };
  EVENT_RATE_LIMITER?: {
    limit(input: { key: string }): Promise<{ success: boolean }>;
  };
};

export async function collectProductEvent(
  request: Request,
  env: ProductEnvironment,
): Promise<Response> {
  const respond = (status: number) =>
    new Response(null, {
      status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    });
  if (request.method !== "POST") return respond(405);
  if (!env.PRODUCT_ANALYTICS || !env.EVENT_RATE_LIMITER) return respond(503);
  const allowed = await env.EVENT_RATE_LIMITER.limit({
    key: `event:${request.headers.get("CF-Connecting-IP") ?? "unknown"}`,
  });
  if (!allowed.success) return respond(429);
  try {
    const reader = request.body?.getReader();
    if (!reader) return respond(400);
    let bytes = 0;
    let body = "";
    const decoder = new TextDecoder();
    let chunk = await reader.read();
    while (!chunk.done) {
      bytes += chunk.value.byteLength;
      if (bytes > 512) {
        await reader.cancel();
        return respond(413);
      }
      body += decoder.decode(chunk.value, { stream: true });
      chunk = await reader.read();
    }
    body += decoder.decode();
    const value = JSON.parse(body);
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      Object.keys(value).sort().join(",") !== "event,minutes,mode,version" ||
      value.version !== 1 ||
      !EVENTS.has(value.event) ||
      !MODES.has(value.mode) ||
      !Number.isInteger(value.minutes) ||
      value.minutes < 0 ||
      value.minutes > 240
    )
      return respond(400);
    env.PRODUCT_ANALYTICS.writeDataPoint({
      blobs: [value.event, value.mode],
      doubles: [1, value.minutes],
    });
    return respond(204);
  } catch {
    return respond(400);
  }
}
