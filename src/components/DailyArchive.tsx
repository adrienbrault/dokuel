import { Check, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import {
  type ArchiveEntry,
  FIRST_DAILY_DATE,
  listDailyArchive,
} from "../lib/daily-archive.ts";
import {
  formatMonthLabel,
  formatShortDate,
  formatTime,
} from "../lib/format.ts";

/** Dates per page. Roughly a month and a half of scrolling. */
const PAGE_SIZE = 45;

export function DailyArchive({
  onBack,
  onPlay,
}: {
  onBack: () => void;
  onPlay: (date: string) => void;
}) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const months = useMemo(() => listDailyArchive({ limit }), [limit]);

  const entries = months.flatMap((month) => month.entries);
  const solved = entries.filter((entry) => entry.result !== null).length;
  const oldest = entries[entries.length - 1]?.date;
  const hasMore = oldest !== undefined && oldest > FIRST_DAILY_DATE;

  return (
    <div className="screen screen-top">
      <div className="screen-content gap-6 py-10">
        <div className="flex flex-col items-center gap-1">
          <h2 className="heading">Past Dailies</h2>
          <p className="text-sm text-text-muted">
            {solved} {solved === 1 ? "day" : "days"} solved
          </p>
        </div>

        {months.map((month) => (
          <section key={month.month} className="flex flex-col gap-2 w-full">
            <h3 className="label">{formatMonthLabel(month.month)}</h3>
            <div className="card w-full divide-y divide-border-default overflow-hidden">
              {month.entries.map((entry) => (
                <ArchiveRow
                  key={entry.date}
                  entry={entry}
                  onClick={() => onPlay(entry.date)}
                />
              ))}
            </div>
          </section>
        ))}

        {hasMore && (
          <button
            type="button"
            className="btn btn-secondary w-full py-2.5 touch-manipulation"
            onClick={() => setLimit((current) => current + PAGE_SIZE)}
          >
            Show more
          </button>
        )}

        <button
          type="button"
          className="btn-ghost touch-manipulation"
          onClick={onBack}
        >
          ← Back
        </button>
      </div>
    </div>
  );
}

function ArchiveRow({
  entry,
  onClick,
}: {
  entry: ArchiveEntry;
  onClick: () => void;
}) {
  const { result } = entry;
  return (
    <button
      type="button"
      // 44px minimum touch target: this is a long list of small rows.
      className="w-full flex items-center gap-3 px-4 py-3 text-left touch-manipulation"
      onClick={onClick}
    >
      <span className="flex-1 text-sm font-medium text-text-primary">
        {formatShortDate(entry.date)}
      </span>
      {result ? (
        <>
          <span className="text-mono text-xs">{formatTime(result.time)}</span>
          <span
            className="icon-chip w-6 h-6 bg-success/15 text-success"
            aria-hidden="true"
          >
            <Check size={14} strokeWidth={3} />
          </span>
        </>
      ) : (
        <span className="caption text-xs text-text-muted">Not played</span>
      )}
      <ChevronRight size={16} className="text-text-muted" aria-hidden="true" />
    </button>
  );
}
