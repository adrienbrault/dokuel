import type { NumPadPosition } from "../lib/types.ts";

type NumPadProps = {
	position: NumPadPosition;
	activeNumber: number | null;
	remainingCounts: Record<number, number>;
	onNumber: (n: number) => void;
};

export function NumPad({
	position,
	activeNumber,
	remainingCounts,
	onNumber,
}: NumPadProps) {
	const isVertical = position === "left" || position === "right";

	return (
		<div
			className={`
				flex gap-1
				${isVertical ? "flex-col" : "flex-row"}
				${isVertical ? "w-12" : "w-full max-w-[min(100vw-2rem,28rem)]"}
			`}
			role="group"
			aria-label="Number pad"
		>
			{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
				const isActive = activeNumber === n;
				const remaining = remainingCounts[n];
				const isComplete = remaining === 0;

				return (
					<button
						key={n}
						type="button"
						disabled={isComplete}
						className={`
							flex flex-col items-center justify-center
							${isVertical ? "h-9 w-12" : "h-12 flex-1"}
							rounded-lg
							transition-all duration-100
							select-none touch-manipulation
							text-lg font-semibold
							${isComplete ? "opacity-30 cursor-default" : "active:scale-95"}
							${
								isActive
									? "bg-accent text-white shadow-md"
									: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200"
							}
						`}
						onClick={() => onNumber(n)}
						aria-label={`${n}, ${remaining} remaining`}
					>
						<span className="leading-none">{n}</span>
						{remaining > 0 && (
							<span className="text-[0.5rem] opacity-60 leading-none mt-0.5">
								{remaining}
							</span>
						)}
					</button>
				);
			})}
		</div>
	);
}
