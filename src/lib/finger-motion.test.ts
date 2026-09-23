import { describe, expect, it } from "vitest";
import { fingerStroke, fingerTravel } from "./finger-motion.ts";

describe("fingerStroke", () => {
  it("lifts and touches down again between separate gestures", () => {
    expect(
      fingerStroke(
        { kind: "tap", digit: 3 },
        { kind: "select", row: 0, col: 0 },
      ),
    ).toBe("touch");
    expect(
      fingerStroke(
        { kind: "select", row: 0, col: 0 },
        { kind: "tap", digit: 3 },
      ),
    ).toBe("touch");
    expect(
      fingerStroke({ kind: "hold", digit: 3 }, { kind: "skim", digit: 4 }),
    ).toBe("touch");
  });

  it("stays in contact while skimming the pad and dragging off it", () => {
    expect(
      fingerStroke({ kind: "skim", digit: 4 }, { kind: "skim", digit: 5 }),
    ).toBe("slide");
    const drop = { digit: 7, row: 1, col: 1, mode: "value" } as const;
    expect(
      fingerStroke({ kind: "skim", digit: 7 }, { kind: "drag", ...drop }),
    ).toBe("slide");
    expect(
      fingerStroke(
        { kind: "drag", ...drop },
        { kind: "drag", ...drop, mode: "note" },
      ),
    ).toBe("slide");
    expect(
      fingerStroke({ kind: "drag", ...drop }, { kind: "drop", ...drop }),
    ).toBe("slide");
  });
});

describe("fingerTravel", () => {
  const from = { x: 0, y: 0 };
  const to = { x: 300, y: 0 };

  it("starts and ends exactly on the two points", () => {
    const { points } = fingerTravel(from, to, "touch");
    expect(points[0]).toEqual(from);
    expect(points.at(-1)).toEqual(to);
  });

  it("arcs a lifted finger off the straight line between them", () => {
    const { points } = fingerTravel(from, to, "touch");
    const mid = points[Math.floor(points.length / 2)]!;
    expect(Math.abs(mid.y)).toBeGreaterThan(10);
  });

  it("keeps a sliding finger on a near-straight line", () => {
    const { points } = fingerTravel(from, to, "slide");
    for (const p of points) expect(Math.abs(p.y)).toBeLessThan(10);
  });

  it("takes longer to travel further, within human bounds", () => {
    const near = fingerTravel(from, { x: 40, y: 0 }, "touch").ms;
    const far = fingerTravel(from, { x: 600, y: 0 }, "touch").ms;
    expect(far).toBeGreaterThan(near);
    expect(near).toBeGreaterThanOrEqual(180);
    expect(far).toBeLessThanOrEqual(650);
  });

  it("eases in and out: slow near the ends, fast in the middle", () => {
    const { points } = fingerTravel(from, to, "touch");
    const step = (i: number) =>
      Math.hypot(
        points[i + 1]!.x - points[i]!.x,
        points[i + 1]!.y - points[i]!.y,
      );
    const middle = Math.floor(points.length / 2);
    expect(step(0)).toBeLessThan(step(middle));
    expect(step(points.length - 2)).toBeLessThan(step(middle));
  });

  it("stays put when there is nowhere to go", () => {
    const { points } = fingerTravel(to, to, "touch");
    for (const p of points) expect(p).toEqual(to);
  });
});
