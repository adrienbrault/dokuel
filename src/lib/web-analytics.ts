/**
 * Cloudflare Web Analytics (cookieless page views). Build-time only:
 * vite.config.ts injects these tags into index.html when the Pages
 * project sets VITE_CF_BEACON_TOKEN, and builds without it ship no
 * third-party script at all.
 *
 * Shaped like Vite's HtmlTagDescriptor so the config can hand it over
 * as is, without this module importing Vite.
 */

export type HtmlTag = {
  tag: string;
  attrs: Record<string, string | boolean>;
  injectTo: "body";
};

const BEACON_SRC = "https://static.cloudflareinsights.com/beacon.min.js";

// Site tokens are hex; anything else is a misconfiguration and must
// not be interpolated into an HTML attribute.
const TOKEN_RE = /^[A-Za-z0-9]+$/;

export function webAnalyticsTags(token: string | undefined): HtmlTag[] {
  if (!token || !TOKEN_RE.test(token)) return [];
  return [
    {
      tag: "script",
      attrs: {
        defer: true,
        src: BEACON_SRC,
        "data-cf-beacon": JSON.stringify({ token }),
      },
      injectTo: "body",
    },
  ];
}
