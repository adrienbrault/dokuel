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
    <div className="flex gap-1.5 sm:gap-3 w-full max-w-lg">
      <ControlButton
        label="Undo"
        icon="↩"
        onClick={onUndo}
        disabled={!historyLength || historyLength === 0}
      />
      <ControlButton label="Erase" icon="⌫" onClick={onErase} />
      {onHint && <ControlButton label="Hint" icon="💡" onClick={onHint} />}
    </div>
  );
}

function ControlButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean | undefined;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`flex-1 flex flex-col items-center justify-center h-12 rounded-lg select-none touch-manipulation ${
        disabled
          ? "bg-bg-disabled text-text-disabled cursor-default"
          : "bg-bg-raised text-text-secondary press-spring"
      }`}
      onClick={onClick}
      aria-label={label}
    >
      <span className="text-lg leading-none">{icon}</span>
      <span className="text-[0.625rem] mt-0.5 leading-none">{label}</span>
    </button>
  );
}
