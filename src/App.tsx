import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DarkModeToggle } from "./components/DarkModeToggle.tsx";
import { DifficultyPicker } from "./components/DifficultyPicker.tsx";
import { Landing } from "./components/Landing.tsx";
import { MultiplayerGame } from "./components/MultiplayerGame.tsx";
import { SoloGame } from "./components/SoloGame.tsx";
import { SoundToggle } from "./components/SoundToggle.tsx";
import { useDarkMode } from "./hooks/useDarkMode.ts";
import { getDailyPuzzle } from "./lib/daily.ts";
import { recordDailyCompletion } from "./lib/daily-streak.ts";
import { formatShortDate } from "./lib/format.ts";
import { generatePlayerName } from "./lib/name-generator.ts";
import { getSoundEnabled, setSoundEnabled } from "./lib/sounds.ts";
import type { Difficulty } from "./lib/types.ts";
import "./index.css";

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function getPlayerId() {
  let id = localStorage.getItem("sudoku_player_id");
  if (!id) {
    // Migrate from sessionStorage if present
    id = sessionStorage.getItem("sudoku_player_id");
    if (!id) {
      id = generateId();
    }
    localStorage.setItem("sudoku_player_id", id);
  }
  return id;
}

function getPlayerName() {
  let name = localStorage.getItem("sudoku_player_name");
  if (!name) {
    // Migrate from sessionStorage if present
    name = sessionStorage.getItem("sudoku_player_name");
    if (!name) {
      name = generatePlayerName();
    }
    localStorage.setItem("sudoku_player_name", name);
  }
  return name;
}

function setPlayerName(name: string) {
  localStorage.setItem("sudoku_player_name", name);
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
        <div className="screen relative">
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
        <div className="screen">
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
  const [playerName, setName] = useState(getPlayerName);

  const handleRename = useCallback((name: string) => {
    setName(name);
    setPlayerName(name);
  }, []);

  return (
    <MultiplayerGame
      roomId={roomId}
      playerId={playerId}
      playerName={playerName}
      onRename={handleRename}
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) onJoin(code.trim());
  };

  return (
    <div className="screen">
      <form className="screen-content gap-6" onSubmit={handleSubmit}>
        <h2 className="heading">Join Game</h2>
        <div className="flex flex-col items-center gap-2 w-full">
          <input
            ref={inputRef}
            type="text"
            placeholder="Enter room code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="card w-full px-4 py-3 text-text-primary text-center text-lg font-mono"
          />
          <p className="text-xs text-text-muted">
            Ask the host for their room code
          </p>
        </div>
        <button
          type="submit"
          disabled={!code.trim()}
          className={`btn btn-lg w-full transition-colors ${
            code.trim()
              ? "btn-primary"
              : "bg-bg-disabled text-text-disabled cursor-not-allowed"
          }`}
        >
          Join
        </button>
        <button
          type="button"
          className="btn-ghost mt-2 touch-manipulation"
          onClick={onBack}
        >
          ← Back
        </button>
      </form>
    </div>
  );
}

function DailyGame({ onBack }: { onBack: () => void }) {
  const { puzzle, date } = useMemo(() => getDailyPuzzle(), []);
  const handleComplete = useCallback(() => {
    recordDailyCompletion(date);
  }, [date]);

  return (
    <SoloGame
      difficulty="medium"
      gameKey={`daily-${date}`}
      initialPuzzle={puzzle}
      title={`Daily — ${formatShortDate(date)}`}
      onBack={onBack}
      onComplete={handleComplete}
    />
  );
}

export default App;
