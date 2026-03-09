export function Sparkline({
  times,
  width,
  height,
}: {
  times: number[];
  width: number;
  height: number;
}) {
  if (times.length < 2) return null;

  const min = Math.min(...times);
  const max = Math.max(...times);
  const range = max - min || 1;
  const pad = 4;

  const points = times
    .map((t, i) => {
      const x = pad + (i / (times.length - 1)) * (width - pad * 2);
      const y = pad + (1 - (t - min) / range) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const lastX =
    pad + ((times.length - 1) / (times.length - 1)) * (width - pad * 2);
  const lastY =
    pad + (1 - (times[times.length - 1]! - min) / range) * (height - pad * 2);

  return (
    <svg
      width={width}
      height={height}
      className="text-accent"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r={3} fill="currentColor" />
    </svg>
  );
}
