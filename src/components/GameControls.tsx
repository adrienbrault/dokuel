import { Eraser, Lightbulb, PencilLine, Redo2, Undo2 } from "lucide-react";
import type { ReactNode } from "react";

type GameControlsProps = {
  onErase: () => void;
  onUndo: () => void;
  onRedo: () => void;
  /**
   * Pencils every empty cell's candidates. Omitted at paper assist,
   * where the game offers no help at all.
   */
  onFillNotes?: (() => void) | undefined;
  historyLength?: number | undefined;
  redoLength?: number | undefined;
  onHint?: (() => void) | undefined;
};

export function GameControls({
  onErase,
  onUndo,
  onRedo,
  onFillNotes,
  historyLength,
  redoLength,
  onHint,
}: GameControlsProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      <ControlButton
        label="Undo"
        hideLabel
        onClick={onUndo}
        disabled={!historyLength || historyLength === 0}
      >
        <Undo2 size={17} strokeWidth={2.25} aria-hidden="true" />
      </ControlButton>
      <ControlButton
        label="Redo"
        hideLabel
        onClick={onRedo}
        disabled={!redoLength || redoLength === 0}
      >
        <Redo2 size={17} strokeWidth={2.25} aria-hidden="true" />
      </ControlButton>
      <ControlButton label="Erase" onClick={onErase}>
        <Eraser size={17} strokeWidth={2.25} aria-hidden="true" />
      </ControlButton>
      {onFillNotes && (
        <ControlButton
          label="Notes"
          ariaLabel="Fill notes"
          onClick={onFillNotes}
        >
          <PencilLine size={17} strokeWidth={2.25} aria-hidden="true" />
        </ControlButton>
      )}
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
  ariaLabel,
  hideLabel,
  onClick,
  disabled,
  children,
}: {
  label: string;
  /** Spoken name when the visible label is too terse to stand alone. */
  ariaLabel?: string | undefined;
  /**
   * Drop the visible text at every width. Undo and Redo carry it: the
   * paired arrows read on their own, and five labelled controls do not
   * fit a 320px phone.
   */
  hideLabel?: boolean | undefined;
  onClick: () => void;
  disabled?: boolean | undefined;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl border border-border-default bg-surface select-none touch-manipulation transition-colors ${
        disabled
          ? "text-text-disabled opacity-50 cursor-default"
          : "text-text-secondary hover:bg-surface-hover press-spring-soft"
      }`}
      onClick={onClick}
      aria-label={ariaLabel ?? label}
    >
      <span aria-hidden="true">{children}</span>
      {!hideLabel && (
        // Phones show icons only: the five controls would otherwise
        // run off a 320px screen.
        <span className="hidden sm:inline text-xs font-semibold leading-none">
          {label}
        </span>
      )}
    </button>
  );
}
