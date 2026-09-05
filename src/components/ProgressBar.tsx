type ProgressBarProps = {
  label: string;
  percent: number;
  /**
   * Cells still empty on that board. The room already syncs it and
   * nothing rendered it: a percentage is an abstraction, while "41
   * left" is the number a racing player actually counts down.
   */
  remaining?: number;
  color: string;
};

export function ProgressBar({
  label,
  percent,
  remaining,
  color,
}: ProgressBarProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-text-secondary w-16 shrink-0 truncate">
        {label}
      </span>
      <div className="flex-1 min-w-0 h-2 rounded-full bg-bg-raised overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-300`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs text-text-secondary font-mono tabular-nums shrink-0 text-right whitespace-nowrap">
        {remaining === undefined
          ? `${percent}%`
          : `${percent}% · ${remaining} left`}
      </span>
    </div>
  );
}
