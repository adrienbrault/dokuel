import type { DemoAction } from "./landing-demo.ts";

/**
 * How the landing demo's finger moves between two gestures, as pure
 * geometry: the component samples it into keyframes. The goal is a
 * thumb, not a cursor: it lifts, travels on a slight arc, speeds up
 * and slows down, and only stays on the glass while sliding.
 */

export type Point = { x: number; y: number };

/**
 * "touch": the finger lifts off, travels, and touches down again.
 * "slide": it stays on the glass (skimming the pad, dragging a digit).
 */
export type FingerStroke = "touch" | "slide";

const IN_CONTACT: ReadonlySet<DemoAction["kind"]> = new Set(["skim", "drag"]);
const SLIDES_ON: ReadonlySet<DemoAction["kind"]> = new Set([
  "skim",
  "drag",
  "drop",
]);

export function fingerStroke(prev: DemoAction, next: DemoAction): FingerStroke {
  return IN_CONTACT.has(prev.kind) && SLIDES_ON.has(next.kind)
    ? "slide"
    : "touch";
}

// A lifted thumb bows away from the straight line by this share of
// the distance; a sliding one barely wanders.
const ARC: Record<FingerStroke, number> = { touch: 0.18, slide: 0.02 };
const SAMPLES = 16;

/** Smooth start and stop: slow off the mark, fast mid-way, gentle landing. */
function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * The path and duration from `from` to `to`, sampled at even time
 * steps so the easing lives in the spacing of the points.
 */
export function fingerTravel(
  from: Point,
  to: Point,
  stroke: FingerStroke,
): { points: Point[]; ms: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  // Bow to the thumb's side: perpendicular, always curving the same way
  // a right thumb sweeps, so consecutive trips feel like one hand.
  const bow = distance * ARC[stroke];
  const nx = distance ? -dy / distance : 0;
  const ny = distance ? dx / distance : 0;
  const control = {
    x: from.x + dx / 2 + nx * bow,
    y: from.y + dy / 2 + ny * bow,
  };
  const points: Point[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const t = easeInOut(i / SAMPLES);
    const u = 1 - t;
    points.push({
      x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
      y: u * u * from.y + 2 * u * t * control.y + t * t * to.y,
    });
  }
  points[0] = { ...from };
  points[SAMPLES] = { ...to };
  // Fitts-like: a quick flick for neighbours, longer sweeps for far keys.
  const base = stroke === "slide" ? 160 : 220;
  const ms = Math.min(620, Math.round(base + Math.sqrt(distance) * 14));
  return { points, ms };
}
