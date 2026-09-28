import { type MeshStandardMaterial, Scene, type ShaderMaterial } from "three";
import { describe, expect, it } from "vitest";
import { readPalette } from "./palette.ts";
import { createStage } from "./stage.ts";

function stageFor(pageHex: string, slabHex: string) {
  const scene = new Scene();
  const palette = readPalette((name) =>
    name === "--color-bg-primary"
      ? pageHex
      : name === "--color-board-border"
        ? slabHex
        : "#808080",
  );
  const stage = createStage(scene, palette);
  return { stage, palette, slab: stage.slab.material as MeshStandardMaterial };
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
    expect(slab.color.getHex()).toBe(next.slab.getHex());
    const accent = page.uniforms["accent"] as
      | { value: { getHex(): number } }
      | undefined;
    expect(accent?.value.getHex()).toBe(next.accent.getHex());
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
});
