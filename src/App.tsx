import { useMemo, useRef, useState } from "react";
import { DarkModeToggle } from "./components/DarkModeToggle.tsx";
import { DifficultyPicker } from "./components/DifficultyPicker.tsx";
import { Landing } from "./components/Landing.tsx";
import { MultiplayerGame } from "./components/MultiplayerGame.tsx";
import { SoloGame } from "./components/SoloGame.tsx";
import { SoundToggle } from "./components/SoundToggle.tsx";
import { useDarkMode } from "./hooks/useDarkMode.ts";
import { getDailyPuzzle } from "./lib/daily.ts";
import { getSoundEnabled, setSoundEnabled } from "./lib/sounds.ts";
import type { Difficulty } from "./lib/types.ts";
import "./index.css";

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function getPlayerId() {
  let id = sessionStorage.getItem("sudoku_player_id");
  if (!id) {
    id = generateId();
    sessionStorage.setItem("sudoku_player_id", id);
  }
  return id;
}

function getPlayerName() {
  return (
    sessionStorage.getItem("sudoku_player_name") ||
    `Player ${generateId().slice(0, 4)}`
  );
}

type Screen =
  | { name: "landing" }
  | { name: "difficulty"; mode: "solo" | "create" }
  | { name: "solo"; difficulty: Difficulty; gameId: number }
  | { name: "daily" }
  | { name: "multiplayer"; roomId: string; difficulty: Difficulty }
  | { name: "join" };

function App() {
  const [screen, setScreen] = useState<Screen>(() => {
    const path = window.location.pathname.slice(1);
    if (path && path !== "") {
      return {
        name: "multiplayer",
        roomId: path,
        difficulty: "medium" as Difficulty,
      };
    }
    return { name: "landing" };
  });
  const gameIdRef = useRef(0);
  const darkMode = useDarkMode();
  const [soundOn, setSoundOn] = useState(getSoundEnabled);

  switch (screen.name) {
    case "landing":
      return (
        <div className="flex min-h-dvh items-center justify-center bg-white dark:bg-gray-950 relative animate-screen-enter">
          <div className="absolute top-4 right-4 flex gap-1">
            <SoundToggle
              enabled={soundOn}
              onToggle={() => {
                const next = !soundOn;
                setSoundOn(next);
                setSoundEnabled(next);
              }}
            />
            <DarkModeToggle
              isDark={darkMode.isDark}
              onToggle={darkMode.toggle}
            />
          </div>
          <Landing
            onSolo={() => setScreen({ name: "difficulty", mode: "solo" })}
            onDaily={() => setScreen({ name: "daily" })}
            onCreate={() => setScreen({ name: "difficulty", mode: "create" })}
            onJoin={() => setScreen({ name: "join" })}
          />
        </div>
      );

    case "difficulty":
      return (
        <div className="flex min-h-dvh items-center justify-center bg-white dark:bg-gray-950 animate-screen-enter">
          <DifficultyPicker
            onSelect={(difficulty) => {
              if (screen.mode === "solo") {
                gameIdRef.current++;
                setScreen({
                  name: "solo",
                  difficulty,
                  gameId: gameIdRef.current,
                });
              } else {
                const roomId = generateId();
                window.history.pushState(null, "", `/${roomId}`);
                setScreen({ name: "multiplayer", roomId, difficulty });
              }
            }}
            onBack={() => setScreen({ name: "landing" })}
          />
        </div>
      );

    case "solo":
      return (
        <SoloGame
          key={screen.gameId}
          difficulty={screen.difficulty}
          onBack={() => setScreen({ name: "landing" })}
          onRematch={() => {
            gameIdRef.current++;
            setScreen({
              name: "solo",
              difficulty: screen.difficulty,
              gameId: gameIdRef.current,
            });
          }}
        />
      );

    case "daily":
      return <DailyGame onBack={() => setScreen({ name: "landing" })} />;

    case "multiplayer":
      return (
        <MultiplayerScreen
          roomId={screen.roomId}
          difficulty={screen.difficulty}
          onBack={() => {
            window.history.pushState(null, "", "/");
            setScreen({ name: "landing" });
          }}
        />
      );

    case "join":
      return (
        <JoinScreen
          onJoin={(roomId) => {
            window.history.pushState(null, "", `/${roomId}`);
            setScreen({
              name: "multiplayer",
              roomId,
              difficulty: "medium",
            });
          }}
          onBack={() => setScreen({ name: "landing" })}
        />
      );
  }
}

function MultiplayerScreen({
  roomId,
  difficulty,
  onBack,
}: {
  roomId: string;
  difficulty: Difficulty;
  onBack: () => void;
}) {
  const playerId = useMemo(getPlayerId, []);
  const playerName = useMemo(getPlayerName, []);

  return (
    <MultiplayerGame
      roomId={roomId}
      playerId={playerId}
      playerName={playerName}
      difficulty={difficulty}
      onBack={onBack}
    />
  );
}

function JoinScreen({
  onJoin,
  onBack,
}: {
  onJoin: (roomId: string) => void;
  onBack: () => void;
}) {
  const [code, setCode] = useState("");

  return (
    <div className="flex min-h-dvh items-center justify-center bg-white dark:bg-gray-950 animate-screen-enter">
      <div className="flex flex-col items-center gap-6 w-full max-w-sm px-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Join Game
        </h2>
        <input
          type="text"
          placeholder="Enter room code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100 text-center text-lg font-mono"
        />
        <button
          type="button"
          disabled={!code.trim()}
          className={`
						w-full py-4 rounded-xl text-lg font-semibold
						press-spring-soft select-none touch-manipulation
						${
              code.trim()
                ? "bg-accent text-white shadow-lg shadow-accent/20"
                : "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
            }
					`}
          onClick={() => onJoin(code.trim())}
        >
          Join
        </button>
        <button
          type="button"
          className="text-sm text-gray-400 dark:text-gray-500 mt-2 touch-manipulation"
          onClick={onBack}
        >
          Back
        </button>
      </div>
    </div>
  );
}

function DailyGame({ onBack }: { onBack: () => void }) {
  const { puzzle, solution, date } = useMemo(() => getDailyPuzzle(), []);

  return (
    <div>
      <div className="text-center pt-4 pb-0">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Daily Challenge — {date}
        </p>
      </div>
      <SoloGame
        difficulty="medium"
        initialPuzzle={puzzle}
        initialSolution={solution}
        onBack={onBack}
      />
    </div>
  );
}

export default App;
