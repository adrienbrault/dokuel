import { useEffect, useState } from "react";
import type { Reaction } from "../hooks/mp-connection.ts";
import { haptics } from "../lib/haptics.ts";

const VISIBLE_MS = 2_000;

type OpponentReactionProps = {
  /**
   * The opponent's standing reaction, or null while they have not sent
   * one. Only its nonce identifies a new send: awareness rebuilds the
   * object on every remote update, silhouette updates included.
   */
  reaction: Reaction | null;
};

/**
 * The opponent's emoji, floating over their progress bar for a beat.
 * Paired with a light buzz: on a phone the player is looking at their
 * own board, not at the header, and a reaction nobody notices is not
 * worth sending. Motion collapses to nothing under
 * prefers-reduced-motion, which the global rule already handles.
 */
export function OpponentReaction({ reaction }: OpponentReactionProps) {
  const [shown, setShown] = useState<Reaction | null>(null);
  const nonce = reaction?.nonce ?? null;

  // Keyed on the nonce, not the object: the same reaction arriving in a
  // fresh wrapper must not buzz the phone again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reaction is read only when its nonce changes
  useEffect(() => {
    if (!reaction) return;
    setShown(reaction);
    haptics.light();
    const id = setTimeout(() => setShown(null), VISIBLE_MS);
    return () => clearTimeout(id);
  }, [nonce]);

  if (!shown) return null;

  return (
    <span
      key={shown.nonce}
      role="status"
      className="pointer-events-none absolute -top-3.5 right-1 text-xl leading-none animate-emoji-bounce"
    >
      {shown.emoji}
    </span>
  );
}
