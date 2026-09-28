import {
  type AmbientLight,
  type MeshStandardMaterial,
  Scene,
  type ShaderMaterial,
} from "three";
import { describe, expect, it } from "vitest";
import { readPalette } from "./palette.ts";
import { createStage } from "./stage.ts";
import { neutralOut, SURFACE_REFLECTANCE } from "./tone.ts";

function stageFor(pageHex: string, slabHex: string, cellHex = "#808080") {
  const scene = new Scene();
  const palette = readPalette((name) =>
    name === "--color-bg-primary"
      ? pageHex
      : name === "--color-board-border"
        ? slabHex
        : name === "--color-cell-bg"
          ? cellHex
          : "#808080",
  );
  const stage = createStage(scene, palette);
  return {
    scene,
    stage,
    palette,
    slab: stage.slab.material as MeshStandardMaterial,
  };
}

/** Perceptual weight of a colour, so surfaces can be ordered by depth. */
function luma(c: { r: number; g: number; b: number }) {
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

/**
 * What the rig shows for a lit surface of this albedo. The shader takes
 * its offset from the darkest channel, and that is the one the inversion
 * lands exactly, so it is the channel worth asserting on.
 */
function delivered(c: { r: number; g: number; b: number }) {
  // The exposure lives inside neutralOut, so only the reflectance of a lit
  // surface is applied here.
  return neutralOut(Math.min(c.r, c.g, c.b) * SURFACE_REFLECTANCE);
}

/** The darkest channel of a colour, which is what the curve is shaped by. */
function darkest(c: { r: number; g: number; b: number }) {
  return Math.min(c.r, c.g, c.b);
}

describe("createStage", () => {
  it("carries the palette into the slab, the lights and the backdrop", () => {
    // A theme flip is a re-read of the tokens, so every surface the stage
    // owns has to take the new values or the board keeps half its theme.
    const { stage } = stageFor("#ffffff", "#3d3a35");
    const next = readPalette(() => "#0f0e0d");
    stage.setPalette(next);
    const slab = stage.slab.material as MeshStandardMaterial;
    const page = stage.page.material as ShaderMaterial;
    // The slab is a lit surface, so what matters is the tone it shows
    // after the rig's curve, not the number stored in its material.
    expect(delivered(slab.color)).toBeCloseTo(darkest(next.slab), 3);
    const accent = page.uniforms["accent"] as
      | { value: { getHex(): number } }
      | undefined;
    expect(accent?.value.getHex()).toBe(next.accent.getHex());
    stage.dispose();
  });

  it("keeps the slab darker than the tiles standing in it", () => {
    // The dark theme writes the border token as a light rim, which is right
    // for a hairline around a DOM cell and wrong for the wide floor a 3D
    // board shows between its tiles: it reads as a concrete grid rather
    // than a recess, so the slab has to fall back to the page's own tone.
    const { stage, palette, slab } = stageFor("#0f0e0d", "#9a958c", "#121110");
    expect(delivered(slab.color)).toBeLessThan(darkest(palette.cell));
    stage.dispose();
  });

  it("keeps a border token that is already a recess", () => {
    // The light theme's border is dark, which is exactly the floor the
    // tiles want - and a dark floor is the case the curve's toe crushes,
    // so the test is that it still shows the token it was handed.
    const { stage, palette, slab } = stageFor("#ffffff", "#3d3a35", "#ffffff");
    expect(delivered(slab.color)).toBeCloseTo(darkest(palette.slab), 3);
    stage.dispose();
  });

  it("hands a dark slab more albedo than its tint", () => {
    // The recess between tiles is the largest surface the board shows, and
    // the toe of the output curve turns a dark floor into a black hole. The
    // material has to carry the inverse of what the curve will do to it.
    const { stage, palette, slab } = stageFor("#0f0e0d", "#2a2724", "#808080");
    expect(luma(slab.color)).toBeGreaterThan(luma(palette.slab));
    stage.dispose();
  });

  it("starts the completion flare dark", () => {
    // The flare is blown out through the bloom pass, so it has to be off
    // until the board is actually finished.
    const { stage } = stageFor("#ffffff", "#3d3a35");
    expect(stage.flare.intensity).toBe(0);
    stage.dispose();
  });

  it("stretches the backdrop past the frame", () => {
    // The canvas is opaque, so anything left uncovered by the backdrop is
    // a bare clear-colour edge on the page.
    const { stage } = stageFor("#ffffff", "#3d3a35");
    stage.coverPage(1, 12);
    expect(stage.page.scale.x).toBeGreaterThan(2 * Math.tan(Math.PI / 12) * 12);
    stage.dispose();
  });
  it("carries the flip into the bounce fill", () => {
    // The fill stands in for light the page throws back into the recess,
    // so it has to take the page's new tone. A dark theme holding on to a
    // white bounce would keep lifting its tiles out of their own palette.
    const { stage, scene } = stageFor("#ffffff", "#3d3a35");
    const next = readPalette(() => "#0f0e0d");
    stage.setPalette(next);
    const bounce = scene.children.find(
      (child) => (child as AmbientLight).isAmbientLight,
    ) as AmbientLight;
    expect(bounce.color.getHex()).toBe(next.page.getHex());
    stage.dispose();
  });
});
