import { Swords } from "lucide-react";
import { formatShortTime } from "../lib/format.ts";
import type { Challenge } from "../lib/types.ts";

/**
 * The quiet pill under the header on a board opened from a "beat my
 * time" link: who set the time and what it was. Deliberately not a
 * second clock, just the number to race.
 */
export function ChallengeBanner({ challenge }: { challenge: Challenge }) {
  return (
    <div className="flex items-center gap-1.5 -mt-2 mb-2 max-w-full px-3 py-1 rounded-full bg-bg-inset text-xs text-text-secondary animate-fade-in">
      <Swords size={12} aria-hidden="true" className="shrink-0 text-accent" />
      <span className="truncate">{challenge.name}'s time</span>
      <span className="font-mono font-bold tabular-nums text-text-primary">
        {formatShortTime(challenge.seconds)}
      </span>
      {challenge.hinted && (
        <span className="shrink-0 text-text-muted">· hints</span>
      )}
    </div>
  );
}
