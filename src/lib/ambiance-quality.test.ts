import { describe, expect, it } from "vitest";
import { pickQuality } from "./ambiance-quality.ts";

describe("pickQuality", () => {
  it("gives a desktop the full treatment", () => {
    const quality = pickQuality({
      devicePixelRatio: 2,
      hardwareConcurrency: 8,
      coarsePointer: false,
    });

    expect(quality).toMatchObject({ pixelRatio: 2, bloom: true, gameFps: 60 });
  });

  it("caps a phone's pixel ratio and paces gameplay at 30fps to save battery", () => {
    const quality = pickQuality({
      devicePixelRatio: 3,
      hardwareConcurrency: 6,
      coarsePointer: true,
    });

    expect(quality.pixelRatio).toBe(1.5);
    expect(quality.gameFps).toBe(30);
  });

  it("drops bloom on a low-core device", () => {
    const quality = pickQuality({
      devicePixelRatio: 2,
      hardwareConcurrency: 2,
      coarsePointer: true,
    });

    expect(quality.bloom).toBe(false);
    expect(quality.pixelRatio).toBe(1);
  });
});
