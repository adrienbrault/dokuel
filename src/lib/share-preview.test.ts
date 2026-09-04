import { expect, it } from "vitest";
import { getSharePreview, renderSharePreview } from "./share-preview.ts";

it("renders challenge previews without executing or reflecting untrusted markup", () => {
  const path = `/challenge/${btoa(JSON.stringify({ version: 1, difficulty: "easy", timeSeconds: 91 }))}`;
  const preview = getSharePreview(path);
  expect(preview?.title).toBe("Beat 01:31 · Easy Sudoku — Dokuel");
  expect(getSharePreview("/challenge/garbage")).toBeNull();
  const html =
    '<title>Old</title><meta property="og:title" content="Old" /><meta property="og:description" content="Old" />';
  const rendered = renderSharePreview(html, {
    title: '<img onerror="bad">',
    description: "Play & compare",
  });
  expect(rendered).not.toContain("<img");
  expect(rendered).toContain("&lt;img");
});

it("previews receipt times with a distinct canonical URL and rejects out-of-range timings", () => {
  const encode = (value: unknown) =>
    `/receipt/${btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")}`;
  const path = encode({
    version: 1,
    challenger: { timeSeconds: 90 },
    friend: { timeSeconds: 100 },
  });
  const preview = getSharePreview(path);
  expect(preview?.title).toBe("01:30 vs 01:40 — Dokuel");
  const html =
    '<meta property="og:url" content="https://dokuel.com/" /><link rel="canonical" href="https://dokuel.com/" />';
  expect(
    renderSharePreview(html, preview!, `https://dokuel.com${path}`),
  ).toContain(path);
  expect(getSharePreview(encode({ version: 2 }))).toBeNull();
  expect(
    getSharePreview(
      encode({
        version: 1,
        challenger: { timeSeconds: -1 },
        friend: { timeSeconds: 0 },
      }),
    ),
  ).toBeNull();
  expect(getSharePreview("/")).toBeNull();
});
