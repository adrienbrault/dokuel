import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DarkModeToggle } from "./components/DarkModeToggle.tsx";
import { DifficultyPicker } from "./components/DifficultyPicker.tsx";
import { Landing } from "./components/Landing.tsx";
import { MultiplayerGame } from "./components/MultiplayerGame.tsx";
import { SoloGame } from "./components/SoloGame.tsx";
import { SoundToggle } from "./components/SoundToggle.tsx";
import { useDarkMode } from "./hooks/useDarkMode.ts";
import { getDailyPuzzle } from "./lib/daily.ts";
import { formatShortDate } from "./lib/format.ts";
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
  | {
      name: "solo";
      difficulty: Difficulty;
      gameId: number;
      gameKey: string;
      showConflicts: boolean;
    }
  | { name: "daily" }
  | {
      name: "multiplayer";
      roomId: string;
      difficulty: Difficulty;
      showConflicts: boolean;
    }
  | { name: "join" };

const VALID_DIFFICULTIES = new Set<string>([
  "easy",
  "medium",
  "hard",
  "expert",
]);

function screenToPath(screen: Screen): string {
  switch (screen.name) {
    case "landing":
    case "difficulty":
      return "/";
    case "solo":
      return `/solo/${screen.difficulty}/${screen.gameKey}`;
    case "daily":
      return "/daily";
    case "join":
      return "/join";
    case "multiplayer":
      return `/${screen.roomId}`;
  }
}

function pathToScreen(pathname: string): Screen {
  const path = pathname.replace(/^\/+|\/+$/g, "");

  if (path === "") return { name: "landing" };
  if (path === "daily") return { name: "daily" };
  if (path === "join") return { name: "join" };

  if (path.startsWith("solo/")) {
    const parts = path.slice(5).split("/");
    const difficulty = parts[0] ?? "";
    const gameKey = parts[1] ?? "";
    if (VALID_DIFFICULTIES.has(difficulty) && gameKey) {
      return {
        name: "solo",
        difficulty: difficulty as Difficulty,
        gameId: 1,
        gameKey,
        showConflicts: true,
      };
    }
    return { name: "landing" };
  }

  // Everything else is treated as a multiplayer roomId
  return {
    name: "multiplayer",
    roomId: path,
    difficulty: "medium" as Difficulty,
    showConflicts: true,
  };
}

function App() {
  const [screen, setScreen] = useState<Screen>(() =>
    pathToScreen(window.location.pathname),
  );

  const navigate = useCallback(
    (newScreen: Screen, { replace = false } = {}) => {
      const path = screenToPath(newScreen);
      if (replace) {
        window.history.replaceState(null, "", path);
      } else {
        window.history.pushState(null, "", path);
      }
      setScreen(newScreen);
    },
    [],
  );

  useEffect(() => {
    const handlePopState = () => {
      setScreen(pathToScreen(window.location.pathname));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const gameIdRef = useRef(screen.name === "solo" ? screen.gameId : 0);
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
            onSolo={() => navigate({ name: "difficulty", mode: "solo" })}
            onDaily={() => navigate({ name: "daily" })}
            onCreate={() => navigate({ name: "difficulty", mode: "create" })}
            onJoin={() => navigate({ name: "join" })}
          />
        </div>
      );

    case "difficulty":
      return (
        <div className="flex min-h-dvh items-center justify-center bg-white dark:bg-gray-950 animate-screen-enter">
          <DifficultyPicker
            onSelect={(difficulty, showConflicts) => {
              if (screen.mode === "solo") {
                gameIdRef.current++;
                navigate({
                  name: "solo",
                  difficulty,
                  gameId: gameIdRef.current,
                  gameKey: generateId(),
                  showConflicts,
                });
              } else {
                const roomId = generateId();
                navigate({
                  name: "multiplayer",
                  roomId,
                  difficulty,
                  showConflicts,
                });
              }
            }}
            onBack={() => navigate({ name: "landing" })}
          />
        </div>
      );

    case "solo":
      return (
        <SoloGame
          key={screen.gameKey}
          difficulty={screen.difficulty}
          gameKey={screen.gameKey}
          showConflicts={screen.showConflicts}
          onBack={() => navigate({ name: "landing" })}
          onRematch={() => {
            gameIdRef.current++;
            navigate(
              {
                name: "solo",
                difficulty: screen.difficulty,
                gameId: gameIdRef.current,
                gameKey: generateId(),
                showConflicts: screen.showConflicts,
              },
              { replace: true },
            );
          }}
        />
      );

    case "daily":
      return <DailyGame onBack={() => navigate({ name: "landing" })} />;

    case "multiplayer":
      return (
        <MultiplayerScreen
          roomId={screen.roomId}
          difficulty={screen.difficulty}
          showConflicts={screen.showConflicts}
          onBack={() => navigate({ name: "landing" })}
        />
      );

    case "join":
      return (
        <JoinScreen
          onJoin={(roomId) => {
            navigate({
              name: "multiplayer",
              roomId,
              difficulty: "medium",
              showConflicts: true,
            });
          }}
          onBack={() => navigate({ name: "landing" })}
        />
      );
  }
}

function MultiplayerScreen({
  roomId,
  difficulty,
  showConflicts,
  onBack,
}: {
  roomId: string;
  difficulty: Difficulty;
  showConflicts: boolean;
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
      showConflicts={showConflicts}
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
						select-none touch-manipulation transition-colors
						${
              code.trim()
                ? "bg-accent text-white shadow-lg shadow-accent/20 press-spring-soft"
                : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
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
          ← Back
        </button>
      </div>
    </div>
  );
}

function DailyGame({ onBack }: { onBack: () => void }) {
  const { puzzle, date } = useMemo(() => getDailyPuzzle(), []);

  return (
    <SoloGame
      difficulty="medium"
      gameKey={`daily-${date}`}
      initialPuzzle={puzzle}
      title={`Daily — ${formatShortDate(date)}`}
      onBack={onBack}
    />
  );
}

export default App;
