import type { NumPadPosition } from "../lib/types.ts";

type NumPadPositionToggleProps = {
	position: NumPadPosition;
	onChange: (position: NumPadPosition) => void;
};

const OPTIONS: { value: NumPadPosition; label: string }[] = [
	{ value: "left", label: "←" },
	{ value: "bottom", label: "↓" },
	{ value: "right", label: "→" },
];

export function NumPadPositionToggle({
	position,
	onChange,
}: NumPadPositionToggleProps) {
	return (
		<div
			className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1"
			role="radiogroup"
			aria-label="Number pad position"
		>
			{OPTIONS.map((opt) => (
				<button
					key={opt.value}
					type="button"
					role="radio"
					aria-checked={position === opt.value}
					className={`
						w-8 h-8 rounded-md flex items-center justify-center
						text-sm transition-all duration-150 select-none
						${
							position === opt.value
								? "bg-white dark:bg-gray-700 shadow-sm text-accent font-bold"
								: "text-gray-400 dark:text-gray-500"
						}
					`}
					onClick={() => onChange(opt.value)}
					aria-label={`Pad ${opt.value}`}
				>
					{opt.label}
				</button>
			))}
		</div>
	);
}
