import { describe, expect, it } from "vitest";
import { Spring } from "./spring.ts";

function run(spring: Spring, seconds: number) {
  for (let t = 0; t < seconds; t += 1 / 60) spring.step(1 / 60);
}

describe("Spring", () => {
  it("settles on its target", () => {
    const s = new Spring(0);
    s.target = 10;
    expect(s.settled).toBe(false);
    run(s, 2);
    expect(s.value).toBeCloseTo(10, 2);
    expect(s.settled).toBe(true);
  });

  it("overshoots when under-damped, for a bouncy pop", () => {
    const s = new Spring(0, 300, 10);
    s.target = 1;
    let peak = 0;
    for (let i = 0; i < 60; i++) {
      s.step(1 / 60);
      peak = Math.max(peak, s.value);
    }
    expect(peak).toBeGreaterThan(1.05);
  });

  it("springs back after a kick without moving its target", () => {
    const s = new Spring(0);
    s.kick(50);
    s.step(1 / 60);
    expect(s.value).toBeGreaterThan(0);
    run(s, 3);
    expect(s.value).toBeCloseTo(0, 2);
  });

  it("stays stable through a long frame", () => {
    const s = new Spring(0, 400, 30);
    s.target = 1;
    s.step(0.5);
    expect(Number.isFinite(s.value)).toBe(true);
    expect(Math.abs(s.value)).toBeLessThan(2);
  });
});
