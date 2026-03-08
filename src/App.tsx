import { useCallback, useEffect, useRef, useState } from "react";
import { DailyGame } from "./components/DailyGame.tsx";
import { DarkModeToggle } from "./components/DarkModeToggle.tsx";
import { DifficultyPicker } from "./components/DifficultyPicker.tsx";
import { JoinScreen } from "./components/JoinScreen.tsx";
import { Landing } from "./components/Landing.tsx";
import { MultiplayerScreen } from "./components/MultiplayerScreen.tsx";
import { SoloGame } from "./components/SoloGame.tsx";
import { SoundToggle } from "./components/SoundToggle.tsx";
import { Stats } from "./components/Stats.tsx";
import { useDarkMode } from "./hooks/useDarkMode.ts";
import { generateRoomCode } from "./lib/room-code.ts";
import { getSoundEnabled, setSoundEnabled } from "./lib/sounds.ts";
import type { Difficulty } from "./lib/types.ts";
import "./index.css";

function generateId() {
  return Math.random().toString(36).slice(2, 10);
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
  | { name: "join" }
  | { name: "stats" };

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
    case "stats":
      return "/stats";
    case "multiplayer":
      return `/${screen.roomId}`;
  }
}

function pathToScreen(pathname: string): Screen {
  const path = pathname.replace(/^\/+|\/+$/g, "");

  if (path === "") return { name: "landing" };
  if (path === "daily") return { name: "daily" };
  if (path === "join") return { name: "join" };
  if (path === "stats") return { name: "stats" };

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
            onStats={() => navigate({ name: "stats" })}
            onContinue={(gameKey, difficulty) => {
              gameIdRef.current++;
              navigate({
                name: "solo",
                difficulty: difficulty as Difficulty,
                gameId: gameIdRef.current,
                gameKey,
                showConflicts: true,
              });
            }}
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
                const roomId = generateRoomCode();
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

    case "stats":
      return <Stats onBack={() => navigate({ name: "landing" })} />;

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

export default App;
