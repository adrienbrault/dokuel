import { formatTime } from "./format.ts";

export type SharePreview = { title: string; description: string };
const DIFFICULTIES: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  expert: "Expert",
};
function time(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 864_000
  );
}

/** Cosmetic metadata only. The client performs full puzzle/receipt validation.
 * Do not solve untrusted puzzles at the public HTTP boundary. */
export function getSharePreview(path: string): SharePreview | null {
  const match = /^\/(challenge|receipt)\/([A-Za-z0-9_=-]{1,4000})$/.exec(path);
  if (!match) return null;
  try {
    const binary = atob(
      match[2]?.replaceAll("-", "+").replaceAll("_", "/") ?? "",
    );
    const data = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(binary, (char) => char.charCodeAt(0)),
      ),
    );
    if (data?.version !== 1) return null;
    if (
      match[1] === "challenge" &&
      Object.hasOwn(DIFFICULTIES, data.difficulty) &&
      time(data.timeSeconds)
    ) {
      return {
        title: `Beat ${formatTime(data.timeSeconds)} · ${DIFFICULTIES[data.difficulty]} Sudoku — Dokuel`,
        description:
          "Play the same puzzle when you have time, then send your result back. Free, no account needed.",
      };
    }
    if (
      match[1] === "receipt" &&
      time(data.challenger?.timeSeconds) &&
      time(data.friend?.timeSeconds)
    ) {
      return {
        title: `${formatTime(data.challenger.timeSeconds)} vs ${formatTime(data.friend.timeSeconds)} — Dokuel`,
        description:
          "Your friend sent a Sudoku comparison. See both results and start another challenge.",
      };
    }
  } catch {
    /* Invalid links retain the generic page preview. */
  }
  return null;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function renderSharePreview(
  html: string,
  preview: SharePreview,
  url?: string,
): string {
  const rendered = html
    .replace(
      /<title>[^<]*<\/title>/,
      () => `<title>${escapeHtml(preview.title)}</title>`,
    )
    .replace(
      /(<meta (?:property|name)="(?:og:title|twitter:title)" content=")[^"]*("\s*\/?\s*>)/g,
      (_match, start, end) => `${start}${escapeHtml(preview.title)}${end}`,
    )
    .replace(
      /(<meta (?:property|name)="(?:description|og:description|twitter:description)" content=")[^"]*("\s*\/?\s*>)/g,
      (_match, start, end) =>
        `${start}${escapeHtml(preview.description)}${end}`,
    );
  if (!url) return rendered;
  return rendered
    .replace(
      /(<meta property="og:url" content=")[^"]*(")/,
      (_match, start, end) => `${start}${escapeHtml(url)}${end}`,
    )
    .replace(
      /(<link rel="canonical" href=")[^"]*(")/,
      (_match, start, end) => `${start}${escapeHtml(url)}${end}`,
    );
}
