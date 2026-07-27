import { Eraser, Lightbulb, Undo2 } from "lucide-react";
import type { ReactNode } from "react";

type GameControlsProps = {
  onErase: () => void;
  onUndo: () => void;
  historyLength?: number | undefined;
  onHint?: (() => void) | undefined;
};

/**
 * Undo / Erase / Hint. Lives in GameLayout's rail, which is a horizontal
 * strip between the board and the number pad on a phone and a vertical
 * column beside the board on desktop — so these lay themselves out along
 * whichever axis the rail is using.
 */
export function GameControls({
  onErase,
  onUndo,
  historyLength,
  onHint,
}: GameControlsProps) {
  return (
    <div className="flex flex-row lg:flex-col items-stretch justify-center gap-2 w-full">
      <ControlButton
        label="Undo"
        onClick={onUndo}
        disabled={!historyLength || historyLength === 0}
        badge={historyLength ? String(historyLength) : undefined}
      >
        <Undo2 size={17} strokeWidth={2.25} aria-hidden="true" />
      </ControlButton>
      <ControlButton label="Erase" onClick={onErase}>
        <Eraser size={17} strokeWidth={2.25} aria-hidden="true" />
      </ControlButton>
      {onHint && (
        <ControlButton label="Hint" onClick={onHint}>
          <Lightbulb size={17} strokeWidth={2.25} aria-hidden="true" />
        </ControlButton>
      )}
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  disabled,
  badge,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean | undefined;
  badge?: string | undefined;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`relative flex flex-1 lg:flex-none items-center justify-center lg:justify-start gap-2 px-3.5 lg:px-3 h-11 rounded-control border border-border-default bg-surface select-none touch-manipulation transition-colors ${
        disabled
          ? "text-text-disabled opacity-60 cursor-default"
          : "text-text-secondary hover:bg-surface-hover hover:text-text-primary press-spring-soft"
      }`}
      onClick={onClick}
      aria-label={label}
    >
      <span aria-hidden="true">{children}</span>
      <span className="text-sm font-semibold leading-none">{label}</span>
      {badge && (
        <span
          className="ml-auto hidden lg:inline-block text-[0.6875rem] font-bold tabular-nums text-text-muted"
          aria-hidden="true"
        >
          {badge}
        </span>
      )}
    </button>
  );
}
