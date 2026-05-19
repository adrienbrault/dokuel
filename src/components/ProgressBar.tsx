type ProgressBarProps = {
  label: string;
  percent: number;
  color: string;
};

export function ProgressBar({ label, percent, color }: ProgressBarProps) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-xs font-medium text-text-secondary w-20 truncate">
        {label}
      </span>
      <div className="flex-1 h-2.5 rounded-full bg-bg-inset overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-300`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-text-secondary tabular-nums w-9 text-right">
        {percent}%
      </span>
    </div>
  );
}
