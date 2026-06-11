import { Eraser, Lightbulb, Undo2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./ui/button.tsx";

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
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={disabled}
      className="gap-1.5 touch-manipulation"
      onClick={onClick}
      aria-label={label}
    >
      <span aria-hidden="true">{children}</span>
      <span className="text-xs font-semibold leading-none">{label}</span>
    </Button>
  );
}
