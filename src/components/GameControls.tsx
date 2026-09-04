import { Eraser, Lightbulb, Pencil, Undo2 } from "lucide-react";
import type { ReactNode } from "react";

type GameControlsProps = {
  onErase: () => void;
  onUndo: () => void;
  disabled?: boolean | undefined;
  historyLength?: number | undefined;
  notesMode?: boolean | undefined;
  onToggleNotes?: (() => void) | undefined;
  onHint?: (() => void) | undefined;
};

export function GameControls({
  onErase,
  onUndo,
  historyLength,
  disabled = false,
  onHint,
  notesMode = false,
  onToggleNotes,
}: GameControlsProps) {
  return (
    <div className="flex items-center justify-center gap-1.5 flex-wrap">
      {onToggleNotes && (
        <ControlButton
          label="Notes"
          onClick={onToggleNotes}
          disabled={disabled}
          pressed={notesMode}
        >
          <Pencil size={17} strokeWidth={2.25} aria-hidden="true" />
        </ControlButton>
      )}
      <ControlButton
        label="Undo"
        onClick={onUndo}
        disabled={disabled || !historyLength}
      >
        <Undo2 size={17} strokeWidth={2.25} aria-hidden="true" />
      </ControlButton>
      <ControlButton label="Erase" onClick={onErase} disabled={disabled}>
        <Eraser size={17} strokeWidth={2.25} aria-hidden="true" />
      </ControlButton>
      {onHint && (
        <ControlButton label="Hint" onClick={onHint} disabled={disabled}>
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
  children,
  pressed,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean | undefined;
  children: ReactNode;
  pressed?: boolean | undefined;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={pressed}
      className={`flex items-center justify-center gap-1.5 px-2.5 py-2 min-h-11 rounded-xl border border-border-default bg-surface select-none touch-manipulation transition-colors ${
        disabled
          ? "text-text-disabled opacity-50 cursor-default"
          : pressed
            ? "text-accent bg-accent-light ring-1 ring-accent"
            : "text-text-secondary hover:bg-surface-hover press-spring-soft"
      }`}
      onClick={onClick}
      aria-label={label}
    >
      <span aria-hidden="true">{children}</span>
      <span className="text-xs font-semibold leading-none">{label}</span>
    </button>
  );
}
