import { getSharePreview, renderSharePreview } from "../src/lib/share-preview.ts";

export async function onRequest(context: { request: Request; next(): Promise<Response> }): Promise<Response> {
  const response = await context.next();
  const preview = getSharePreview(new URL(context.request.url).pathname);
  if (!preview || !response.headers.get("content-type")?.includes("text/html")) return response;
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("etag");
  headers.set("X-Robots-Tag", "noindex, nofollow");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("Cache-Control", "private, no-store");
  return new Response(renderSharePreview(await response.text(), preview), { status: response.status, headers });
}
