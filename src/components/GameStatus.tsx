import type { ReactNode } from "react";

type GameStatusProps = {
  /** The running clock. */
  time: ReactNode;
  /** Cells filled out of 81. */
  filled: number;
  /** Rendered under the clock — personal best, "Paused", opponent state. */
  note?: ReactNode | undefined;
  /** Present on solo boards, where tapping the clock pauses. */
  onClick?: (() => void) | undefined;
  ariaLabel?: string | undefined;
};

const TOTAL_CELLS = 81;

/**
 * The clock, the fill count and a progress bar as one block in the game
 * header.
 *
 * The count used to be rendered as the string "46/81", which is a number
 * a player has to read and then divide to learn anything from. The bar
 * carries the same value pre-divided, so progress is legible at a glance
 * and the digits are there for anyone who wants them.
 */
export function GameStatus({
  time,
  filled,
  note,
  onClick,
  ariaLabel,
}: GameStatusProps) {
  const percent = Math.round((filled / TOTAL_CELLS) * 100);
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      {...(onClick
        ? { type: "button" as const, onClick, "aria-label": ariaLabel }
        : {})}
      className="flex flex-col items-center gap-1 px-4 py-1.5 rounded-panel bg-surface border border-border-default w-[9.5rem] touch-manipulation"
      style={{ boxShadow: "var(--elevation-1)" }}
    >
      {time}
      <div
        className="w-full h-1 rounded-full bg-bg-inset overflow-hidden"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Puzzle progress"
      >
        <span
          className="block h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-[0.625rem] leading-none text-text-muted tabular-nums">
        {note ?? (
          <>
            <span className="font-semibold text-text-secondary">{filled}</span>
            <span> / {TOTAL_CELLS}</span>
          </>
        )}
      </span>
    </Tag>
  );
}
