import { Color } from "three";
import { describe, expect, it } from "vitest";
import { inkColour, resolveCellTarget, tileColour } from "./cell-targets.ts";
import type { BoardPalette } from "./palette.ts";
import type { CellVisual } from "./scene-state.ts";

function palette(): BoardPalette {
  const grey = new Color(0.5, 0.5, 0.5);
  return {
    page: new Color(1, 1, 1),
    slab: grey,
    cell: grey,
    selected: new Color(0.1, 0.9, 0.1),
    highlight: new Color(0.2, 0.2, 0.9),
    same: new Color(0.9, 0.9, 0.2),
    band: new Color(0.4, 0.4, 0.4),
    hint: new Color(0.9, 0.4, 0.9),
    conflictBg: new Color(0.9, 0.1, 0.1),
    conflict: new Color(0.8, 0, 0),
    given: new Color(0, 0, 0),
    user: new Color(0.3, 0.3, 0.3),
    accent: new Color(0, 0.8, 0.5),
    accentBright: new Color(0, 1, 0.6),
    enteredDisc: new Color(0.7, 0.2, 0.2),
    note: new Color(0.4, 0.4, 0.4),
    digits: Array.from({ length: 9 }, (_, i) => new Color(i / 9, 0, 0)),
  };
}

function cell(overrides: Partial<CellVisual> = {}): CellVisual {
  return {
    row: 0,
    col: 0,
    state: "idle",
    ink: "user",
    value: null,
    isGiven: false,
    notes: [],
    emoji: null,
    hover: false,
    charging: false,
    dragSource: false,
    dropTarget: null,
    dropMode: "value",
    dropDigit: null,
    revealDelayMs: null,
    ...overrides,
  };
}

describe("tileColour", () => {
  it("maps each visual state to its token", () => {
    const p = palette();
    expect(tileColour("selected", p)).toBe(p.selected);
    expect(tileColour("highlight", p)).toBe(p.highlight);
    expect(tileColour("matchRowCol", p)).toBe(p.band);
    expect(tileColour("same", p)).toBe(p.same);
    expect(tileColour("hint", p)).toBe(p.hint);
    expect(tileColour("conflict", p)).toBe(p.conflictBg);
    expect(tileColour("idle", p)).toBe(p.cell);
  });
});

describe("inkColour", () => {
  it("separates givens from user entries", () => {
    const p = palette();
    expect(inkColour(cell({ ink: "given" }), p, "off")).toBe(p.given);
    expect(inkColour(cell({ ink: "user" }), p, "off")).toBe(p.user);
  });

  it("switches to the conflict colour for a plain entry", () => {
    const p = palette();
    expect(inkColour(cell({ ink: "conflict" }), p, "off")).toBe(p.conflict);
  });

  it("keeps the digit hue in digits mode, where a colour names a digit", () => {
    const p = palette();
    const conflicted = cell({ ink: "conflict", value: 3 });
    expect(inkColour(conflicted, p, "digits")).toBe(p.digits[2]);
  });

  it("leaves emoji glyphs untinted, since they are painted into the texture", () => {
    const p = palette();
    expect(inkColour(cell({ value: 5, emoji: "🔵" }), p, "emoji")).toEqual(
      new Color(1, 1, 1),
    );
  });
});

describe("resolveCellTarget", () => {
  it("rests an idle cell flat and unlit", () => {
    const target = resolveCellTarget(cell(), palette());
    expect(target.lift).toBe(0);
    expect(target.glow).toBe(0);
    expect(target.dropPreview).toBe(false);
  });

  it("lifts a hovered cell and gives it a faint glow", () => {
    const target = resolveCellTarget(cell({ hover: true }), palette());
    expect(target.lift).toBeGreaterThan(0);
    expect(target.glow).toBeGreaterThan(0);
  });

  it("stacks a hover on top of a selection instead of replacing it", () => {
    const p = palette();
    const plain = resolveCellTarget(cell({ state: "selected" }), p);
    const hovered = resolveCellTarget(
      cell({ state: "selected", hover: true }),
      p,
    );
    expect(hovered.lift).toBeGreaterThan(plain.lift);
    expect(hovered.colour).toBe(p.selected);
  });

  it("raises the dragged cell above everything else", () => {
    const p = palette();
    const drag = resolveCellTarget(cell({ dragSource: true }), p);
    const selected = resolveCellTarget(cell({ state: "selected" }), p);
    expect(drag.lift).toBeGreaterThan(selected.lift);
  });

  it("marks a valid drop target for a brighter rim", () => {
    const p = palette();
    const target = resolveCellTarget(cell({ dropTarget: "valid" }), p);
    expect(target.dropPreview).toBe(true);
    expect(target.colour).toBe(p.selected);
    expect(target.lift).toBeGreaterThan(0);
  });

  it("paints an invalid drop target with the conflict colour", () => {
    const p = palette();
    const target = resolveCellTarget(cell({ dropTarget: "invalid" }), p);
    expect(target.dropPreview).toBe(false);
    expect(target.colour).toBe(p.conflictBg);
    expect(target.glow).toBeGreaterThan(resolveCellTarget(cell(), p).glow);
  });

  it("never dims a hint below its own glow when hovered", () => {
    const p = palette();
    const hint = resolveCellTarget(cell({ state: "hint" }), p);
    const hovered = resolveCellTarget(cell({ state: "hint", hover: true }), p);
    expect(hovered.glow).toBeGreaterThanOrEqual(hint.glow);
  });
});
