export function ProgressBar({
  label,
  percent,
  color,
}: {
  label?: string | undefined;
  percent: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {label && (
        <span className="text-xs text-text-secondary w-24 truncate">
          {label}
        </span>
      )}
      <div className="flex-1 h-2 rounded-full bg-bg-raised overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-300`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs text-text-secondary font-mono tabular-nums w-8 text-right">
        {percent}%
      </span>
    </div>
  );
}
