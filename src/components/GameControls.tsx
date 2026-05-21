import type { ReactNode } from "react";
import { SpriteIcon } from "./SpriteIcon.tsx";

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
        <SpriteIcon name="undoToken" className="w-5 h-5" />
      </ControlButton>
      <ControlButton label="Erase" onClick={onErase}>
        <SpriteIcon name="eraseToken" className="w-5 h-5" />
      </ControlButton>
      {onHint && (
        <ControlButton label="Hint" onClick={onHint}>
          <SpriteIcon name="hintToken" className="w-5 h-5" />
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
      className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-border-default bg-surface select-none touch-manipulation transition-colors ${
        disabled
          ? "text-text-disabled opacity-50 cursor-default"
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
