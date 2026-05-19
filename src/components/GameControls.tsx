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
        <Undo2 size={19} strokeWidth={2} aria-hidden="true" />
      </ControlButton>
      <ControlButton label="Erase" onClick={onErase}>
        <Eraser size={19} strokeWidth={2} aria-hidden="true" />
      </ControlButton>
      {onHint && (
        <ControlButton label="Hint" onClick={onHint}>
          <Lightbulb size={19} strokeWidth={2} aria-hidden="true" />
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
      className={`flex flex-col items-center justify-center gap-1 w-[4.75rem] py-2 rounded-xl bg-bg-inset border border-border-default select-none touch-manipulation transition-all ${
        disabled
          ? "text-text-disabled opacity-50 cursor-default"
          : "text-text-secondary hover:bg-bg-raised hover:text-text-primary press-spring-soft"
      }`}
      onClick={onClick}
      aria-label={label}
    >
      <span aria-hidden="true">{children}</span>
      <span className="text-[0.625rem] leading-none font-semibold">
        {label}
      </span>
    </button>
  );
}
