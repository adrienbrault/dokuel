import { expect, it } from "vitest";
import { onRequest } from "../../functions/_middleware.ts";

it("serves distinct crawler metadata while retaining app HTML and dropping stale entity headers", async () => {
  const path = `/challenge/${btoa(JSON.stringify({ version: 1, difficulty: "easy", timeSeconds: 91 }))}`;
  const response = await onRequest({ request: new Request(`https://dokuel.com${path}?ignored=yes`), next: async () => new Response('<title>Old</title><meta property="og:title" content="Old" /><meta property="og:url" content="Old" /><div id="root"></div>', { headers: { "Content-Type": "text/html", "Content-Length": "5", ETag: "old", "Content-Encoding": "gzip" } }) });
  expect(response.headers.get("content-encoding")).toBeNull();
  expect(response.headers.get("content-length")).toBeNull();
  expect(response.headers.get("etag")).toBeNull();
  const html = await response.text();
  expect(html).toContain("Beat 01:31");
  expect(html).toContain('<div id="root"></div>');
  expect(html).not.toContain("ignored=yes");
});
