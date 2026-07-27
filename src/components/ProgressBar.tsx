type ProgressBarProps = {
  label: string;
  percent: number;
  color: string;
};

export function ProgressBar({ label, percent, color }: ProgressBarProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-text-secondary w-24 truncate">
        {label}
      </span>
      <div className="relative flex-1 h-[3px] rounded-full bg-bg-raised">
        <div
          className={`h-full rounded-full ${color} transition-all duration-300`}
          style={{ width: `${percent}%` }}
        />
        {/* Runner dot capping the ink fill — the racer on the lane. */}
        {percent > 0 && (
          <span
            aria-hidden="true"
            className={`absolute top-1/2 w-[7px] h-[7px] -translate-y-1/2 -translate-x-1/2 rounded-full ${color} ring-2 ring-surface transition-[left] duration-300`}
            style={{ left: `${percent}%` }}
          />
        )}
      </div>
      <span className="font-mono text-[0.6875rem] text-text-muted tabular-nums w-8 text-right">
        {percent}%
      </span>
    </div>
  );
}
