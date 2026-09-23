import type { ProgressPoint } from "../lib/replay.ts";

export type TimelineSeries = {
  id: string;
  color: string;
  points: ProgressPoint[];
};

type ReplayTimelineProps = {
  series: TimelineSeries[];
  /** Cells to fill, the chart's top line. */
  total: number;
  duration: number;
  t: number;
  onScrub: (t: number) => void;
};

const WIDTH = 1000;
const HEIGHT = 100;

/**
 * Each player's filled-cell count as a step line, extended flat to the
 * end of the match so a player who finished early reads as a finished
 * line rather than one that stopped short.
 */
function stepPath(
  points: ProgressPoint[],
  total: number,
  duration: number,
): string {
  const x = (t: number) => (t / duration) * WIDTH;
  const y = (filled: number) => HEIGHT - (filled / total) * (HEIGHT - 4) - 2;
  let d = "";
  let prevY = y(0);
  for (const p of points) {
    d += d === "" ? `M${x(p.t)},${prevY}` : `H${x(p.t)}`;
    prevY = y(p.filled);
    d += `V${prevY}`;
  }
  return `${d}H${WIDTH}`;
}

/**
 * The race at a glance with the scrubber under it: where the lines
 * diverge is where the match was won.
 */
export function ReplayTimeline({
  series,
  total,
  duration,
  t,
  onScrub,
}: ReplayTimelineProps) {
  const safeDuration = Math.max(duration, 1);
  const safeTotal = Math.max(total, 1);
  return (
    <div className="flex flex-col gap-1 w-full">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="w-full h-12 rounded-lg bg-bg-inset"
        aria-hidden="true"
      >
        {series.map((s) => (
          <path
            key={s.id}
            d={stepPath(s.points, safeTotal, safeDuration)}
            fill="none"
            stroke={s.color}
            strokeWidth={2.5}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <line
          x1={(t / safeDuration) * WIDTH}
          x2={(t / safeDuration) * WIDTH}
          y1={0}
          y2={HEIGHT}
          className="stroke-text-primary"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <input
        type="range"
        aria-label="Replay time"
        min={0}
        max={safeDuration}
        step={1}
        value={Math.min(t, safeDuration)}
        onChange={(e) => onScrub(Number(e.target.value))}
        className="w-full accent-accent touch-pan-y"
      />
    </div>
  );
}
