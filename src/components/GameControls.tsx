type GameControlsProps = {
  notesMode: boolean;
  onToggleNotes: () => void;
  onErase: () => void;
  onUndo: () => void;
  showConflicts?: boolean | undefined;
  onToggleConflicts?: (() => void) | undefined;
  historyLength?: number | undefined;
  onHint?: (() => void) | undefined;
};

export function GameControls({
  notesMode,
  onToggleNotes,
  onErase,
  onUndo,
  showConflicts,
  onToggleConflicts,
  historyLength,
  onHint,
}: GameControlsProps) {
  return (
    <div className="flex gap-3 w-full max-w-lg">
      <ControlButton
        label="Undo"
        icon="↩"
        onClick={onUndo}
        active={false}
        disabled={!historyLength || historyLength === 0}
      />
      <ControlButton label="Erase" icon="⌫" onClick={onErase} active={false} />
      <ControlButton
        label="Notes"
        icon="✏"
        onClick={onToggleNotes}
        active={notesMode}
      />
      {onToggleConflicts && (
        <ControlButton
          label={showConflicts ? "Errors: On" : "Errors: Off"}
          icon="👁"
          onClick={onToggleConflicts}
          active={showConflicts ?? false}
        />
      )}
      {onHint && (
        <ControlButton label="Hint" icon="💡" onClick={onHint} active={false} />
      )}
    </div>
  );
}

function ControlButton({
  label,
  icon,
  onClick,
  active,
  disabled,
}: {
  label: string;
  icon: string;
  onClick: () => void;
  active: boolean;
  disabled?: boolean | undefined;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`flex-1 flex flex-col items-center justify-center h-12 rounded-lg select-none touch-manipulation ${
        disabled
          ? "bg-bg-disabled text-text-disabled cursor-default"
          : active
            ? "bg-accent text-text-on-accent shadow-md press-spring"
            : "bg-bg-raised text-text-secondary press-spring"
      }`}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
    >
      <span className="text-lg leading-none">{icon}</span>
      <span className="text-[0.625rem] mt-0.5 leading-none">{label}</span>
    </button>
  );
}
