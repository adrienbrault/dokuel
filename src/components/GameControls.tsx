import { Eraser, Lightbulb, Undo2 } from "lucide-react";
import type { ReactNode } from "react";

type GameControlsProps = {
  onErase: () => void;
  onUndo: () => void;
  historyLength?: number | undefined;
  onHint?: (() => void) | undefined;
};

export function GameControls({
  onErase,
  onUndo,
  historyLength,
  onHint,
}: GameControlsProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      <ControlButton
        label="Undo"
        onClick={onUndo}
        disabled={!historyLength || historyLength === 0}
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
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean | undefined;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold select-none touch-manipulation transition-colors ${
        disabled
          ? "cursor-default border-transparent bg-bg-inset text-text-disabled"
          : "border-border-default bg-bg-raised text-text-secondary press-spring-soft hover:text-text-primary"
      }`}
      onClick={onClick}
      aria-label={label}
    >
      <span aria-hidden="true">{children}</span>
      <span>{label}</span>
    </button>
  );
}
