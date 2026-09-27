import { describe, expect, it } from "vitest";
import {
  createFrameMonitor,
  degradeQuality,
  pickQuality,
} from "./ambiance-quality.ts";

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

describe("degradeQuality", () => {
  it("steps the pixel ratio down, then gives up bloom, then bottoms out", () => {
    const quality = pickQuality({
      devicePixelRatio: 2,
      hardwareConcurrency: 8,
      coarsePointer: false,
    });
    const steps: string[] = [];
    for (
      let next = degradeQuality(quality);
      next;
      next = degradeQuality(next)
    ) {
      steps.push(`${next.pixelRatio}${next.bloom ? "+bloom" : ""}`);
    }

    expect(steps).toEqual(["1.5+bloom", "1+bloom", "1", "0.75"]);
  });
});

describe("createFrameMonitor", () => {
  it("asks to degrade only after a sustained run of slow frames", () => {
    const monitor = createFrameMonitor();

    // One long hitch (a GC pause, a tab switch) is not a slow device.
    expect(monitor.sample(200)).toBe(false);
    const verdicts = Array.from({ length: 60 }, () => monitor.sample(40));

    expect(verdicts.slice(0, -1).every((v) => v === false)).toBe(true);
    expect(verdicts.at(-1)).toBe(true);
  });

  it("stays quiet while frames fit the budget", () => {
    const monitor = createFrameMonitor();
    const verdicts = Array.from({ length: 240 }, () => monitor.sample(16));

    expect(verdicts.some(Boolean)).toBe(false);
  });
});
