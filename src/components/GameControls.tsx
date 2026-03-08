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
        badge={historyLength && historyLength > 0 ? historyLength : undefined}
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
          label="Errors"
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
  badge,
}: {
  label: string;
  icon: string;
  onClick: () => void;
  active: boolean;
  badge?: number | undefined;
}) {
  return (
    <button
      type="button"
      className={`flex-1 flex flex-col items-center justify-center h-12 rounded-lg relative press-spring select-none touch-manipulation ${
        active
          ? "bg-accent text-text-on-accent shadow-md"
          : "bg-bg-raised text-text-secondary"
      }`}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
    >
      <span className="text-lg leading-none">{icon}</span>
      <span className="text-[0.625rem] mt-0.5 leading-none">{label}</span>
      {badge !== undefined && (
        <span className="absolute -top-1 -right-1 min-w-[1.125rem] h-[1.125rem] rounded-full bg-accent text-white text-[0.5625rem] font-bold flex items-center justify-center px-1">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}
