import type { ArchivedReplay } from "../lib/replay-archive.ts";
import { MatchReplay } from "./MatchReplay.tsx";

/** A past duel from the local archive, shown in the match replay. */
export function ArchivedMatchReplay({
  replay,
  onClose,
}: {
  replay: ArchivedReplay;
  onClose: () => void;
}) {
  const { me, opponent } = replay;
  return (
    <MatchReplay
      puzzle={replay.puzzle}
      solution={replay.solution}
      players={[
        { id: "me", ...me },
        opponent
          ? { id: "opponent", ...opponent }
          : // The opponent left before sharing their moves.
            {
              id: "opponent",
              name: "Opponent",
              color: "#EF4444",
              won: !me.won,
              frames: null,
            },
      ]}
      onClose={onClose}
      closeLabel="Stats"
    />
  );
}
