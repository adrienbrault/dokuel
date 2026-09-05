type OpponentSilhouetteProps = {
  /** 81 chars, "1" where the opponent's board holds a value. */
  mask: string;
  /**
   * The shared puzzle. Both players race the same givens, so this side
   * can tell the cells the opponent actually wrote from the ones they
   * started with - the mask itself cannot, and does not need to.
   */
  puzzle: string;
};

const CELLS = Array.from({ length: 81 }, (_, i) => i);

const STATE_CLASSES: Record<string, string> = {
  given: "bg-text-muted/25",
  filled: "bg-opponent",
  empty: "bg-border-default",
};

/**
 * The opponent's board at a glance: a 9x9 of dots, tinted where they
 * have written. A percentage says how far along they are; this says
 * where they are working, which is the part that feels like a race.
 * Decorative by design - the progress bar beside it carries the same
 * information in text.
 */
export function OpponentSilhouette({ mask, puzzle }: OpponentSilhouetteProps) {
  return (
    <div
      className="grid grid-cols-9 gap-px shrink-0 self-center"
      aria-hidden="true"
      data-testid="opponent-silhouette"
    >
      {CELLS.map((i) => {
        const state =
          puzzle[i] !== "." ? "given" : mask[i] === "1" ? "filled" : "empty";
        return (
          <span
            key={i}
            data-state={state}
            className={`w-[3px] h-[3px] rounded-[1px] ${STATE_CLASSES[state]}`}
          />
        );
      })}
    </div>
  );
}
