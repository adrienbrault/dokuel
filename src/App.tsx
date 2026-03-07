import { useState } from "react";
import { DifficultyPicker } from "./components/DifficultyPicker.tsx";
import { Landing } from "./components/Landing.tsx";
import { SoloGame } from "./components/SoloGame.tsx";
import type { Difficulty } from "./lib/types.ts";
import "./index.css";

type Screen =
	| { name: "landing" }
	| { name: "difficulty"; mode: "solo" | "create" }
	| { name: "solo"; difficulty: Difficulty }
	| { name: "create"; difficulty: Difficulty }
	| { name: "join" };

function App() {
	const [screen, setScreen] = useState<Screen>({ name: "landing" });

	switch (screen.name) {
		case "landing":
			return (
				<div className="flex min-h-dvh items-center justify-center bg-white dark:bg-gray-950">
					<Landing
						onSolo={() => setScreen({ name: "difficulty", mode: "solo" })}
						onCreate={() => setScreen({ name: "difficulty", mode: "create" })}
						onJoin={() => setScreen({ name: "join" })}
					/>
				</div>
			);

		case "difficulty":
			return (
				<div className="flex min-h-dvh items-center justify-center bg-white dark:bg-gray-950">
					<DifficultyPicker
						onSelect={(difficulty) => {
							if (screen.mode === "solo") {
								setScreen({ name: "solo", difficulty });
							} else {
								setScreen({ name: "create", difficulty });
							}
						}}
						onBack={() => setScreen({ name: "landing" })}
					/>
				</div>
			);

		case "solo":
			return (
				<SoloGame
					key={`${screen.difficulty}-${Date.now()}`}
					difficulty={screen.difficulty}
					onBack={() => setScreen({ name: "landing" })}
				/>
			);

		case "create":
			// TODO: Multiplayer lobby
			return (
				<div className="flex min-h-dvh items-center justify-center bg-white dark:bg-gray-950">
					<p className="text-gray-500">Multiplayer coming soon...</p>
					<button
						type="button"
						className="mt-4 text-accent"
						onClick={() => setScreen({ name: "landing" })}
					>
						Back
					</button>
				</div>
			);

		case "join":
			// TODO: Join game flow
			return (
				<div className="flex min-h-dvh items-center justify-center bg-white dark:bg-gray-950">
					<p className="text-gray-500">Join game coming soon...</p>
					<button
						type="button"
						className="mt-4 text-accent"
						onClick={() => setScreen({ name: "landing" })}
					>
						Back
					</button>
				</div>
			);
	}
}

export default App;
