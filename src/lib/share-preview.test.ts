import { expect, it } from "vitest";
import { getSharePreview, renderSharePreview } from "./share-preview.ts";

it("renders challenge previews without executing or reflecting untrusted markup", () => {
  const path = `/challenge/${btoa(JSON.stringify({ version: 1, difficulty: "easy", timeSeconds: 91 }))}`;
  const preview = getSharePreview(path);
  expect(preview?.title).toBe("Beat 01:31 · Easy Sudoku — Dokuel");
  expect(getSharePreview("/challenge/garbage")).toBeNull();
  const html = '<title>Old</title><meta property="og:title" content="Old" /><meta property="og:description" content="Old" />';
  const rendered = renderSharePreview(html, { title: '<img onerror="bad">', description: "Play & compare" });
  expect(rendered).not.toContain('<img');
  expect(rendered).toContain("&lt;img");
});
