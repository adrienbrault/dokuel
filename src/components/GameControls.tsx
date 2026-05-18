import { Eraser, Lightbulb, Undo2 } from "lucide-react";
import type { ReactNode } from "react";

type GameControlsProps = {
  onErase: () => void;
  onUndo: () => void;
  historyLength?: number | undefined;
  onHint?: (() => void) | undefined;
  /**
   * Icon-only buttons with tighter padding for use in space-constrained
   * layouts (e.g. side-by-side with the 3x3 grid on mobile).
   */
  compact?: boolean | undefined;
};

export function GameControls({
  onErase,
  onUndo,
  historyLength,
  onHint,
  compact = false,
}: GameControlsProps) {
  return (
    <div className="flex items-center justify-center gap-1">
      <ControlButton
        label="Undo"
        compact={compact}
        onClick={onUndo}
        disabled={!historyLength || historyLength === 0}
      >
        <Undo2 size={20} strokeWidth={2} aria-hidden="true" />
      </ControlButton>
      <ControlButton label="Erase" compact={compact} onClick={onErase}>
        <Eraser size={20} strokeWidth={2} aria-hidden="true" />
      </ControlButton>
      {onHint && (
        <ControlButton label="Hint" compact={compact} onClick={onHint}>
          <Lightbulb size={20} strokeWidth={2} aria-hidden="true" />
        </ControlButton>
      )}
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  disabled,
  compact,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean | undefined;
  compact?: boolean | undefined;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`flex flex-col items-center justify-center gap-0.5 rounded-lg select-none touch-manipulation transition-colors ${
        compact ? "w-11 h-11 lg:w-16 lg:h-auto lg:py-1.5" : "w-16 py-1.5"
      } ${
        disabled
          ? "text-text-disabled cursor-default"
          : "text-text-secondary hover:bg-bg-raised press-spring-soft"
      }`}
      onClick={onClick}
      aria-label={label}
    >
      <span aria-hidden="true">{children}</span>
      <span
        className={`text-[0.625rem] leading-none font-medium ${compact ? "hidden lg:block" : ""}`}
      >
        {label}
      </span>
    </button>
  );
}
