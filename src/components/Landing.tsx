type LandingProps = {
	onSolo: () => void;
	onDaily: () => void;
	onCreate: () => void;
	onJoin: () => void;
};

export function Landing({ onSolo, onDaily, onCreate, onJoin }: LandingProps) {
	return (
		<div className="flex flex-col items-center gap-10 w-full max-w-sm px-6">
			<div className="flex flex-col items-center gap-2">
				<h1 className="text-5xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
					Sudoku
				</h1>
				<p className="text-sm text-gray-400 dark:text-gray-500">
					Solo or 1v1 with a friend
				</p>
			</div>
			<div className="flex flex-col gap-3 w-full">
				<ActionButton label="Start Solo" onClick={onSolo} primary />
				<ActionButton label="Daily Challenge" onClick={onDaily} />
				<ActionButton label="Create Game" onClick={onCreate} />
				<ActionButton label="Join Game" onClick={onJoin} />
			</div>
		</div>
	);
}

function ActionButton({
	label,
	onClick,
	primary = false,
}: {
	label: string;
	onClick: () => void;
	primary?: boolean;
}) {
	return (
		<button
			type="button"
			className={`
				w-full py-4 rounded-xl text-lg font-semibold
				press-spring-soft select-none touch-manipulation
				${
					primary
						? "bg-accent text-white shadow-lg shadow-accent/20"
						: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200"
				}
			`}
			onClick={onClick}
		>
			{label}
		</button>
	);
}
