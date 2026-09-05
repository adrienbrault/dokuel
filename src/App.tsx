import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { DailyGame } from "./components/DailyGame.tsx";
import { DarkModeToggle } from "./components/DarkModeToggle.tsx";
import { DifficultyPicker } from "./components/DifficultyPicker.tsx";
import { JoinScreen } from "./components/JoinScreen.tsx";
import { Landing } from "./components/Landing.tsx";
import { NotFoundScreen } from "./components/NotFoundScreen.tsx";
import { SoloGame } from "./components/SoloGame.tsx";
import { SoundToggle } from "./components/SoundToggle.tsx";
import { Stats } from "./components/Stats.tsx";
import { useDarkMode } from "./hooks/useDarkMode.ts";
import { generateId } from "./lib/id.ts";
import { generateRoomCode } from "./lib/room-code.ts";
import { pathToScreen, type Screen, screenToPath } from "./lib/routes.ts";
import { getSoundEnabled, setSoundEnabled } from "./lib/sounds.ts";
import type { Difficulty } from "./lib/types.ts";
import "./index.css";

// The multiplayer screen pulls in yjs + y-webrtc + y-indexeddb —
// none of which solo/daily players need. Splitting it keeps that
// stack out of the entry chunk.
const MultiplayerScreen = lazy(() =>
  import("./components/MultiplayerScreen.tsx").then((m) => ({
    default: m.MultiplayerScreen,
  })),
);

function App() {
  const [screen, setScreen] = useState<Screen>(() =>
    pathToScreen(window.location.pathname, window.location.search),
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
      setScreen(pathToScreen(window.location.pathname, window.location.search));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Canonicalize the address bar once on load: an invalid solo path
  // falls back to the landing screen, a room code gets lowercased —
  // without this the broken URL survives and re-parses on refresh.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only by design — navigate() already writes canonical paths
  useEffect(() => {
    const canonical = screenToPath(screen);
    if (canonical !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, "", canonical);
    }
  }, []);

  const darkMode = useDarkMode();
  const [soundOn, setSoundOn] = useState(getSoundEnabled);

  switch (screen.name) {
    case "landing":
      return (
        <div className="screen relative">
          <div className="absolute top-4 right-4 flex gap-2 z-10">
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
              navigate({
                name: "solo",
                difficulty: difficulty as Difficulty,
                gameKey,
                assistLevel: "standard",
              });
            }}
          />
        </div>
      );

    case "difficulty":
      return (
        <div className="screen">
          <DifficultyPicker
            onSelect={(difficulty, assistLevel) => {
              if (screen.mode === "solo") {
                navigate({
                  name: "solo",
                  difficulty,
                  gameKey: generateId(),
                  assistLevel,
                });
              } else {
                const roomId = generateRoomCode();
                navigate({
                  name: "multiplayer",
                  roomId,
                  difficulty,
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
          assistLevel={screen.assistLevel}
          challenge={screen.challenge}
          onBack={() => navigate({ name: "landing" })}
          onRematch={() => {
            navigate(
              {
                name: "solo",
                difficulty: screen.difficulty,
                gameKey: generateId(),
                assistLevel: screen.assistLevel,
              },
              { replace: true },
            );
          }}
        />
      );

    case "daily":
      return (
        <DailyGame
          key={screen.date ?? "today"}
          date={screen.date}
          onBack={() => navigate({ name: "landing" })}
        />
      );

    case "multiplayer":
      return (
        <Suspense
          fallback={
            <div className="screen">
              <p className="caption">Connecting...</p>
            </div>
          }
        >
          <MultiplayerScreen
            roomId={screen.roomId}
            difficulty={screen.difficulty}
            onBack={() => navigate({ name: "landing" })}
          />
        </Suspense>
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
              difficulty: null,
            });
          }}
          onBack={() => navigate({ name: "landing" })}
        />
      );

    case "notFound":
      return (
        <NotFoundScreen
          path={screen.path}
          onHome={() => navigate({ name: "landing" })}
          onJoin={() => navigate({ name: "join" })}
        />
      );
  }
}

export default App;
