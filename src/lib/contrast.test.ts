/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio, type Oklch, parseOklch } from "./contrast.ts";

describe("contrastRatio", () => {
  const black: Oklch = { l: 0, c: 0, h: 0 };
  const white: Oklch = { l: 1, c: 0, h: 0 };

  it("returns 21 for black on white", () => {
    expect(contrastRatio(black, white)).toBeCloseTo(21, 1);
  });

  it("returns 1 for a colour against itself", () => {
    expect(contrastRatio(white, white)).toBeCloseTo(1, 5);
  });

  it("is symmetric — order of the pair does not matter", () => {
    const accent = parseOklch("oklch(0.53 0.19 278)")!;
    expect(contrastRatio(accent, white)).toBeCloseTo(
      contrastRatio(white, accent),
      10,
    );
  });
});

describe("parseOklch", () => {
  it("reads lightness, chroma and hue", () => {
    expect(parseOklch("oklch(0.53 0.19 278)")).toEqual({
      l: 0.53,
      c: 0.19,
      h: 278,
    });
  });

  it("ignores a trailing alpha", () => {
    expect(parseOklch("oklch(0.86 0.075 278 / 0.42)")?.l).toBe(0.86);
  });

  it("returns null for anything that is not an oklch colour", () => {
    expect(parseOklch("#ff0000")).toBeNull();
  });
});

// ─── The palette itself ───
//
// These read the real token values out of index.css, so the guarantee is
// about the shipped stylesheet rather than a copy of it. A token edit that
// drops a text/background pair below AA fails here.

// Read the shipped stylesheet rather than a copy of the values, so the
// assertions cannot pass against a palette the app no longer uses. Vitest
// stubs `?raw` CSS imports to an empty string, hence going through fs.
const CSS = readFileSync(`${process.cwd()}/src/index.css`, "utf8");

/** Token values from the `@theme` block, i.e. the light scheme. */
const LIGHT = CSS.slice(CSS.indexOf("@theme {"), CSS.indexOf("/* Elevation."));
/** Token values from the `.dark` block, which overrides a subset. */
const DARK = CSS.slice(CSS.indexOf("/* ── Dark mode ── */"));

function token(scope: string, name: string): Oklch {
  const match = new RegExp(`--color-${name}:\\s*(oklch\\([^;]+\\))`).exec(
    scope,
  );
  if (!match) throw new Error(`token --color-${name} not found`);
  const parsed = parseOklch(match[1]!);
  if (!parsed) throw new Error(`--color-${name} is not an oklch value`);
  return parsed;
}

/** Dark mode only overrides some tokens; the rest fall through to :root. */
function darkToken(name: string): Oklch {
  return new RegExp(`--color-${name}:`).test(DARK)
    ? token(DARK, name)
    : token(LIGHT, name);
}

const AA_TEXT = 4.5;
const AA_LARGE = 3;

describe.each([
  ["light", (name: string) => token(LIGHT, name)],
  ["dark", darkToken],
])("%s palette meets WCAG AA", (_scheme, get) => {
  // text-muted is the smallest, lightest copy in the app and lands on all
  // four surfaces — the count under the timer, card sublabels, captions.
  it.each([
    "bg-primary",
    "bg-inset",
    "bg-raised",
    "surface",
  ])("text-muted on %s", (surface) => {
    expect(contrastRatio(get("text-muted"), get(surface))).toBeGreaterThan(
      AA_TEXT,
    );
  });

  it("text-secondary on surface", () => {
    expect(
      contrastRatio(get("text-secondary"), get("surface")),
    ).toBeGreaterThan(AA_TEXT);
  });

  it("text-primary on bg-primary", () => {
    expect(
      contrastRatio(get("text-primary"), get("bg-primary")),
    ).toBeGreaterThan(AA_TEXT);
  });

  // The pair that regressed: accent-surface is what sits under white on
  // primary buttons, the active number-pad key and the active segment.
  it("text-on-accent on accent-surface", () => {
    expect(
      contrastRatio(get("text-on-accent"), get("accent-surface")),
    ).toBeGreaterThan(AA_TEXT);
  });

  it("text-on-accent-muted on accent-surface", () => {
    expect(
      contrastRatio(get("text-on-accent-muted"), get("accent-surface")),
    ).toBeGreaterThan(AA_TEXT);
  });

  // Board digits, at the size they render on a phone.
  it("given digits on a cell", () => {
    expect(contrastRatio(get("cell-given"), get("cell-bg"))).toBeGreaterThan(
      AA_TEXT,
    );
  });

  it("entered digits on a cell", () => {
    expect(contrastRatio(get("cell-user"), get("cell-bg"))).toBeGreaterThan(
      AA_TEXT,
    );
  });

  it("entered digits on a selected cell", () => {
    expect(
      contrastRatio(get("cell-user"), get("cell-selected")),
    ).toBeGreaterThan(AA_LARGE);
  });

  it("conflicting digits on a conflict cell", () => {
    expect(
      contrastRatio(get("cell-conflict"), get("cell-conflict-bg")),
    ).toBeGreaterThan(AA_TEXT);
  });

  it("pencil notes on a cell", () => {
    expect(contrastRatio(get("cell-note"), get("cell-bg"))).toBeGreaterThan(
      AA_LARGE,
    );
  });

  // The 3x3 rules are a meaningful graphic: they are what tells you which
  // box a cell belongs to.
  it("box rules against the cells they separate", () => {
    expect(contrastRatio(get("board-border"), get("cell-bg"))).toBeGreaterThan(
      AA_LARGE,
    );
  });
});
