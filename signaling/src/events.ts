export type EventsEnv = { EVENTS?: AnalyticsEngineDataset };

export async function handleEvents(
  _request: Request,
  _env: EventsEnv,
): Promise<Response> {
  return new Response(null, { status: 501 });
}
