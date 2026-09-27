// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  createAtmosphereDirector,
  emitAtmosphere,
  subscribeAtmosphere,
} from "./atmosphere.ts";

describe("atmosphere event bus", () => {
  it("delivers cues to subscribers", () => {
    const seen: unknown[] = [];
    const unsub = subscribeAtmosphere((e) => seen.push(e));

    emitAtmosphere({ kind: "cue", cue: "place" });
    emitAtmosphere({ kind: "mood", mood: "game" });

    expect(seen).toEqual([
      { kind: "cue", cue: "place" },
      { kind: "mood", mood: "game" },
    ]);
    unsub();
  });

  it("stops delivering after unsubscribe", () => {
    const listener = vi.fn();
    const unsub = subscribeAtmosphere(listener);
    unsub();

    emitAtmosphere({ kind: "cue", cue: "erase" });

    expect(listener).not.toHaveBeenCalled();
  });

  it("keeps other subscribers alive when one throws", () => {
    const survivor = vi.fn();
    subscribeAtmosphere(() => {
      throw new Error("boom");
    });
    const unsub = subscribeAtmosphere(survivor);

    expect(() => emitAtmosphere({ kind: "cue", cue: "hint" })).not.toThrow();
    expect(survivor).toHaveBeenCalledWith({ kind: "cue", cue: "hint" });
    unsub();
  });
});

describe("atmosphere director", () => {
  it("starts in the menu mood with a calm baseline", () => {
    const d = createAtmosphereDirector();
    expect(d.read().mood).toBe("menu");
    expect(d.read().energy).toBe(0);
    expect(d.read().shake).toBe(0);
    expect(d.read().victory).toBe(0);
  });

  it("settles ambient toward the menu baseline", () => {
    const d = createAtmosphereDirector();
    for (let i = 0; i < 120; i++) d.tick(1 / 60);
    expect(d.read().ambient).toBeCloseTo(0.35, 1);
  });

  it("raises the ambient baseline for the game mood", () => {
    const d = createAtmosphereDirector();
    d.apply({ kind: "mood", mood: "game" });
    for (let i = 0; i < 120; i++) d.tick(1 / 60);
    expect(d.read().ambient).toBeGreaterThan(0.45);
  });

  it("a placement bumps energy and queues a ring", () => {
    const d = createAtmosphereDirector();
    d.apply({ kind: "cue", cue: "place" });
    expect(d.read().energy).toBeGreaterThan(0);

    const rings = d.takeRings();
    expect(rings).toHaveLength(1);
    expect(rings[0].strength).toBeGreaterThan(0);
    expect(rings[0].hue).toBe("accent");
  });

  it("draining rings empties the queue", () => {
    const d = createAtmosphereDirector();
    d.apply({ kind: "cue", cue: "place" });
    d.takeRings();
    expect(d.takeRings()).toHaveLength(0);
  });

  it("energy decays back toward zero over time", () => {
    const d = createAtmosphereDirector();
    d.apply({ kind: "cue", cue: "place" });
    const peak = d.read().energy;
    for (let i = 0; i < 180; i++) d.tick(1 / 60);
    expect(d.read().energy).toBeLessThan(peak);
    expect(d.read().energy).toBeLessThan(0.01);
  });

  it("energy is capped at 1", () => {
    const d = createAtmosphereDirector();
    for (let i = 0; i < 20; i++) d.apply({ kind: "cue", cue: "place" });
    expect(d.read().energy).toBeLessThanOrEqual(1);
  });

  it("a conflict flashes danger and shakes", () => {
    const d = createAtmosphereDirector();
    d.apply({ kind: "cue", cue: "conflict" });
    expect(d.read().flash).toBeGreaterThan(0.8);
    expect(d.read().flashHue).toBe("danger");
    expect(d.read().shake).toBeGreaterThan(0.3);

    const rings = d.takeRings();
    expect(rings[0].hue).toBe("danger");
  });

  it("flash and shake decay to rest", () => {
    const d = createAtmosphereDirector();
    d.apply({ kind: "cue", cue: "conflict" });
    for (let i = 0; i < 240; i++) d.tick(1 / 60);
    expect(d.read().flash).toBeLessThan(0.01);
    expect(d.read().shake).toBeLessThan(0.01);
  });

  it("completion ignites a sustained victory glow", () => {
    const d = createAtmosphereDirector();
    d.apply({ kind: "cue", cue: "complete" });
    expect(d.read().victory).toBeGreaterThan(0.9);
    expect(d.read().energy).toBe(1);
    expect(d.read().flashHue).toBe("gold");
    expect(d.takeRings().length).toBeGreaterThanOrEqual(3);

    // Holds high through the celebration, then eases off.
    for (let i = 0; i < 60; i++) d.tick(1 / 60);
    expect(d.read().victory).toBeGreaterThan(0.8);
    for (let i = 0; i < 600; i++) d.tick(1 / 60);
    expect(d.read().victory).toBeLessThan(0.01);
  });

  it("bounds the ring queue so a stalled renderer cannot grow it", () => {
    const d = createAtmosphereDirector();
    for (let i = 0; i < 200; i++) d.apply({ kind: "cue", cue: "place" });
    expect(d.takeRings().length).toBeLessThanOrEqual(12);
  });
});
