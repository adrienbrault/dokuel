type GameControlsProps = {
	notesMode: boolean;
	onToggleNotes: () => void;
	onErase: () => void;
	onUndo: () => void;
};

export function GameControls({
	notesMode,
	onToggleNotes,
	onErase,
	onUndo,
}: GameControlsProps) {
	return (
		<div className="flex gap-3 w-full max-w-lg">
			<ControlButton label="Undo" icon="↩" onClick={onUndo} active={false} />
			<ControlButton label="Erase" icon="⌫" onClick={onErase} active={false} />
			<ControlButton
				label="Notes"
				icon="✏"
				onClick={onToggleNotes}
				active={notesMode}
			/>
		</div>
	);
}

function ControlButton({
	label,
	icon,
	onClick,
	active,
}: {
	label: string;
	icon: string;
	onClick: () => void;
	active: boolean;
}) {
	return (
		<button
			type="button"
			className={`
				flex-1 flex flex-col items-center justify-center
				h-12 rounded-lg
				press-spring
				select-none touch-manipulation
				${
					active
						? "bg-accent text-white shadow-md"
						: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
				}
			`}
			onClick={onClick}
			aria-label={label}
			aria-pressed={active}
		>
			<span className="text-lg leading-none">{icon}</span>
			<span className="text-[0.625rem] mt-0.5 leading-none">{label}</span>
		</button>
	);
}
