export type TurnEnvironment = {
  TURN_KEY_ID?: string;
  TURN_KEY_API_TOKEN?: string;
  TURN_RATE_LIMITER?: {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  };
};

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};

// The caller applies the same origin gate used for WebSocket discovery.
export async function generateTurnCredentials(
  request: Request,
  env: TurnEnvironment,
): Promise<Response> {
  if (request.method !== "GET")
    return new Response("Method not allowed", {
      status: 405,
      headers: { ...headers, Allow: "GET" },
    });
  if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN)
    return new Response("TURN not configured", { status: 404, headers });
  // Cloudflare supplies this header. A client-chosen ID would let anonymous
  // callers evade the limit. A generous cap accommodates shared mobile NATs.
  if (!env.TURN_RATE_LIMITER)
    return new Response("TURN temporarily unavailable", {
      status: 503,
      headers,
    });
  try {
    const { success } = await env.TURN_RATE_LIMITER.limit({
      key: `turn:${request.headers.get("CF-Connecting-IP") ?? "unknown"}`,
    });
    if (!success)
      return new Response("Too many credential requests", {
        status: 429,
        headers: { ...headers, "Retry-After": "60" },
      });
    const response = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`,
      {
        method: "POST",
        signal: AbortSignal.timeout(5_000),
        headers: {
          Authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        // Credentials must outlive a full session, including relay refreshes.
        body: JSON.stringify({ ttl: 86_400 }),
      },
    );
    if (!response.ok)
      return new Response("TURN credential generation failed", {
        status: 502,
        headers,
      });
    return new Response(response.body, {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch {
    return new Response("TURN credential service unavailable", {
      status: 502,
      headers,
    });
  }
}
