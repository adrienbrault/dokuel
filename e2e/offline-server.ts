import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve } from "node:path";

/** A private test server we can genuinely stop, including in WebKit where
 * offline emulation can fail before service-worker navigation is dispatched. */
export async function openOfflineTestServer() {
  const root = resolve("dist");
  const mime: Record<string, string> = {
    ".js": "text/javascript",
    ".css": "text/css",
    ".html": "text/html",
    ".woff2": "font/woff2",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
  };
  const server = createServer(async (request, response) => {
    let path = new URL(request.url ?? "/", "http://localhost").pathname;
    if (!extname(path)) path = "/index.html";
    const file = resolve(root, `.${path}`);
    if (!file.startsWith(`${root}/`)) {
      response.writeHead(403);
      response.end();
      return;
    }
    try {
      response.setHeader(
        "Content-Type",
        mime[extname(path)] ?? "application/octet-stream",
      );
      response.end(await readFile(file));
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No test server port");
  return {
    url: `http://127.0.0.1:${address.port}`,
    async close() {
      if (!server.listening) return;
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
