import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { DailyGame } from "./components/DailyGame.tsx";
import { DarkModeToggle } from "./components/DarkModeToggle.tsx";
import { DifficultyPicker } from "./components/DifficultyPicker.tsx";
import { JoinScreen } from "./components/JoinScreen.tsx";
import { Landing } from "./components/Landing.tsx";
import { SoloGame } from "./components/SoloGame.tsx";
import { SoundToggle } from "./components/SoundToggle.tsx";
import { Stats } from "./components/Stats.tsx";
import { MAX_ROOM_KEY_LENGTH } from "./hooks/mp-connection.ts";
import { useDarkMode } from "./hooks/useDarkMode.ts";
import {
  challengeQuery,
  parseChallenge,
  type SoloChallenge,
} from "./lib/challenge.ts";
import { generateId } from "./lib/id.ts";
import { generateRoomCode } from "./lib/room-code.ts";
import { getSoundEnabled, setSoundEnabled } from "./lib/sounds.ts";
import type { AssistLevel, Difficulty } from "./lib/types.ts";
import "./index.css";

// The multiplayer screen pulls in yjs + y-webrtc + y-indexeddb —
// none of which solo/daily players need. Splitting it keeps that
// stack out of the entry chunk.
const MultiplayerScreen = lazy(() =>
  import("./components/MultiplayerScreen.tsx").then((m) => ({
    default: m.MultiplayerScreen,
  })),
);

type Screen =
  | { name: "landing" }
  | { name: "difficulty"; mode: "solo" | "create" }
  | {
      name: "solo";
      difficulty: Difficulty;
      gameKey: string;
      assistLevel: AssistLevel;
      /** A friend's time to beat, carried by the link that opened it. */
      challenge?: SoloChallenge | undefined;
    }
  | { name: "daily" }
  | {
      name: "multiplayer";
      roomId: string;
      difficulty: Difficulty | null;
    }
  | { name: "join" }
  | { name: "stats" }
  | { name: "notFound"; path: string };

const VALID_DIFFICULTIES = new Set<string>([
  "easy",
  "medium",
  "hard",
  "expert",
]);

// Invite codes are word-word-xxxx (see room-code.ts); the two-word
// form covers links minted before the entropy suffix existed.
const ROOM_CODE_RE = /^[a-z]+-[a-z]+(-[a-z0-9]{4})?$/;

export function screenToPath(screen: Screen): string {
  switch (screen.name) {
    case "landing":
    case "difficulty":
      return "/";
    case "solo":
      return `/solo/${screen.difficulty}/${screen.gameKey}${challengeQuery(screen.challenge)}`;
    case "daily":
      return "/daily";
    case "join":
      return "/join";
    case "stats":
      return "/stats";
    case "multiplayer":
      return `/${screen.roomId}`;
    case "notFound":
      return screen.path;
  }
}

export function pathToScreen(pathname: string, search = ""): Screen {
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
      const challenge = parseChallenge(search);
      return {
        name: "solo",
        difficulty: difficulty as Difficulty,
        gameKey,
        assistLevel: "standard",
        ...(challenge ? { challenge } : {}),
      };
    }
    return { name: "landing" };
  }

  // Only a room-code-shaped path is a multiplayer room. Pasted links
  // arrive capitalized (messaging apps, mobile keyboards) while Yjs
  // room names are case-sensitive — normalize instead of dropping the
  // joiner into a different, empty room. Anything else is a 404, not
  // an excuse to boot the WebRTC stack.
  const candidate = path.toLowerCase();
  if (candidate.length <= MAX_ROOM_KEY_LENGTH && ROOM_CODE_RE.test(candidate)) {
    return {
      name: "multiplayer",
      roomId: candidate,
      difficulty: null,
    };
  }

  return { name: "notFound", path: pathname };
}

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
      return <DailyGame onBack={() => navigate({ name: "landing" })} />;

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
