import { describe, expect, it } from "vitest";
import { webAnalyticsTags } from "./web-analytics.ts";

describe("webAnalyticsTags", () => {
  it("injects nothing without a token", () => {
    expect(webAnalyticsTags(undefined)).toEqual([]);
    expect(webAnalyticsTags("")).toEqual([]);
  });

  it("injects the Cloudflare beacon for a token", () => {
    expect(webAnalyticsTags("0123456789abcdef0123456789abcdef")).toEqual([
      {
        tag: "script",
        attrs: {
          defer: true,
          src: "https://static.cloudflareinsights.com/beacon.min.js",
          "data-cf-beacon": '{"token":"0123456789abcdef0123456789abcdef"}',
        },
        injectTo: "body",
      },
    ]);
  });

  it("refuses a token that is not a plain identifier", () => {
    // The token lands inside an HTML attribute; anything beyond
    // letters and digits is a misconfiguration, not a token.
    expect(webAnalyticsTags('abc"><script>alert(1)</script>')).toEqual([]);
  });
});
