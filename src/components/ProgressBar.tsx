type ProgressBarProps = {
  label: string;
  percent: number;
  /** Tailwind class for the fill. */
  color?: string;
  /** A raw CSS color for the fill, for per-player colors. */
  fill?: string | undefined;
  /**
   * Label and percent stacked over the bar, for bars laid out two to a
   * row: a side-by-side label would leave a half-width bar no room.
   */
  compact?: boolean;
};

export function ProgressBar({
  label,
  percent,
  color = "",
  fill,
  compact = false,
}: ProgressBarProps) {
  const track = (
    <div
      className={`rounded-full bg-bg-raised overflow-hidden ${compact ? "h-1.5 w-full" : "h-2 flex-1"}`}
    >
      <div
        className={`h-full rounded-full ${color} transition-all duration-300`}
        style={{ width: `${percent}%`, backgroundColor: fill }}
      />
    </div>
  );
  const value = (
    <span
      className={`text-xs text-text-secondary font-mono tabular-nums w-8 text-right shrink-0 ${compact ? "leading-none" : ""}`}
    >
      {percent}%
    </span>
  );

  if (compact) {
    return (
      <div className="flex flex-col gap-0.5 min-w-0 leading-none">
        <div className="flex items-baseline gap-2">
          <span className="text-xs leading-none text-text-secondary truncate flex-1">
            {label}
          </span>
          {value}
        </div>
        {track}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-secondary w-24 truncate">{label}</span>
      {track}
      {value}
    </div>
  );
}
