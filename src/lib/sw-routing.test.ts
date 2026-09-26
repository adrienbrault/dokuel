import { describe, expect, it } from "vitest";
import { routeRequest } from "./sw-routing.ts";

const ORIGIN = "https://dokuel.com";
const PRECACHED = new Set(["/", "/assets/index-abc.js"]);

function route(
  url: string,
  { method = "GET", mode = "cors" }: { method?: string; mode?: string } = {},
) {
  return routeRequest({ url, method, mode }, ORIGIN, PRECACHED);
}

describe("routeRequest", () => {
  it("answers same-origin page loads network-first, for any SPA path", () => {
    expect(route("https://dokuel.com/", { mode: "navigate" })).toBe("navigate");
    expect(
      route("https://dokuel.com/solo/easy/abc123", { mode: "navigate" }),
    ).toBe("navigate");
  });

  it("serves precached build assets from the cache", () => {
    expect(route("https://dokuel.com/assets/index-abc.js")).toBe("precached");
  });

  it("never touches the signaling server or any other origin", () => {
    // Live WebRTC rooms depend on these reaching the network untouched.
    expect(route("https://signal.dokuel.com/turn-credentials")).toBe(
      "passthrough",
    );
    expect(route("wss://signal.dokuel.com/")).toBe("passthrough");
    expect(route("https://example.com/", { mode: "navigate" })).toBe(
      "passthrough",
    );
  });

  it("never touches same-origin API paths, even as navigations", () => {
    for (const path of ["/turn-credentials", "/events", "/events/batch"]) {
      expect(route(`https://dokuel.com${path}`)).toBe("passthrough");
      expect(route(`https://dokuel.com${path}`, { mode: "navigate" })).toBe(
        "passthrough",
      );
    }
  });

  it("lets non-GET requests and unknown files through", () => {
    expect(
      route("https://dokuel.com/assets/index-abc.js", { method: "POST" }),
    ).toBe("passthrough");
    expect(route("https://dokuel.com/og-image.png")).toBe("passthrough");
    expect(route("https://dokuel.com/sw.js")).toBe("passthrough");
  });
});
