import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { ChallengeGame } from "./components/ChallengeGame.tsx";
import { DailyGame } from "./components/DailyGame.tsx";
import { DarkModeToggle } from "./components/DarkModeToggle.tsx";
import { DifficultyPicker } from "./components/DifficultyPicker.tsx";
import { JoinScreen } from "./components/JoinScreen.tsx";
import { Landing } from "./components/Landing.tsx";
import { SoloGame } from "./components/SoloGame.tsx";
import { SoundToggle } from "./components/SoundToggle.tsx";
import { Stats } from "./components/Stats.tsx";
import { useDarkMode } from "./hooks/useDarkMode.ts";
import { useProductMeasurement } from "./hooks/useProductMeasurement.ts";
import { challengePath } from "./lib/challenge.ts";
import { generateId } from "./lib/id.ts";
import { pathToScreen, type Screen, screenToPath } from "./lib/navigation.ts";
import { generateRoomCode } from "./lib/room-code.ts";
import { getSoundEnabled, setSoundEnabled } from "./lib/sounds.ts";
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
    pathToScreen(window.location.pathname),
  );
  useProductMeasurement(screen);

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

  // Canonicalize the address bar once on load: an invalid solo path
  // falls back to the landing screen, a room code gets lowercased —
  // without this the broken URL survives and re-parses on refresh.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only by design — navigate() already writes canonical paths
  useEffect(() => {
    const canonical = screenToPath(screen);
    if (canonical !== window.location.pathname) {
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
            onContinue={(game) => {
              if (game.dailyDate) {
                navigate({ name: "daily", date: game.dailyDate });
                return;
              }
              if (game.challenge) {
                navigate({ name: "challenge", challenge: game.challenge });
                return;
              }
              if (game.roomId) {
                navigate({
                  name: "multiplayer",
                  roomId: game.roomId,
                  difficulty: null,
                });
                return;
              }
              navigate({
                name: "solo",
                difficulty: game.difficulty,
                gameKey: game.key,
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

    case "challenge":
      return (
        <ChallengeGame
          key={challengePath(screen.challenge)}
          challenge={screen.challenge}
          onBack={() => navigate({ name: "landing" })}
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
        <div className="screen">
          <div className="screen-content flex flex-col items-center justify-center gap-4 text-center min-h-dvh">
            <h1 className="heading">Page not found</h1>
            <p className="caption max-w-sm">
              Nothing lives at{" "}
              <span className="text-mono break-all">{screen.path}</span>. If a
              friend sent you an invite, double-check the link or enter the room
              code by hand.
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                className="btn btn-lg btn-primary"
                onClick={() => navigate({ name: "landing" })}
              >
                Go to Dokuel
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => navigate({ name: "join" })}
              >
                Enter a room code
              </button>
            </div>
          </div>
        </div>
      );
  }
}

export default App;
