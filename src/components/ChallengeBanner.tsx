import { Timer } from "lucide-react";
import type { SoloChallenge } from "../lib/challenge.ts";
import { formatTime } from "../lib/format.ts";

/**
 * The standing "beat my time" claim carried by the link that opened
 * this board. Deliberately one truncating line: on a short viewport
 * every extra row above the board comes straight out of the grid.
 */
export function ChallengeBanner({ challenge }: { challenge: SoloChallenge }) {
  return (
    <div className="card w-full max-w-lg flex items-center gap-2 px-3 py-1.5">
      <Timer size={14} className="shrink-0 text-accent" aria-hidden="true" />
      <p className="text-xs sm:text-sm text-text-secondary truncate">
        {`${challenge.by} solved this in ${formatTime(challenge.time)}. Beat it!`}
      </p>
    </div>
  );
}
