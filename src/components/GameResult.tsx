type GameResultProps = {
	isWinner: boolean;
	time: string;
	onRematch?: () => void;
	onNewGame: () => void;
};

export function GameResult({
	isWinner,
	time,
	onRematch,
	onNewGame,
}: GameResultProps) {
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6">
			<div className="flex flex-col items-center gap-6 bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-2xl max-w-sm w-full">
				<div className="flex flex-col items-center gap-2">
					<span className="text-4xl">{isWinner ? "🎉" : "👏"}</span>
					<h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
						{isWinner ? "You Won!" : "Puzzle Complete!"}
					</h2>
					<p className="text-sm text-gray-500 dark:text-gray-400">
						Time: {time}
					</p>
				</div>
				<div className="flex flex-col gap-3 w-full">
					{onRematch && (
						<button
							type="button"
							className="w-full py-3 rounded-xl text-lg font-semibold bg-accent text-white active:scale-[0.98] transition-transform select-none touch-manipulation"
							onClick={onRematch}
						>
							Rematch
						</button>
					)}
					<button
						type="button"
						className="w-full py-3 rounded-xl text-lg font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 active:scale-[0.98] transition-transform select-none touch-manipulation"
						onClick={onNewGame}
					>
						New Game
					</button>
				</div>
			</div>
		</div>
	);
}
