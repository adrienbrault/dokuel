import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { About } from "./components/About.tsx";
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
import type { Invite } from "./hooks/usePresence.ts";
import { usePresence } from "./hooks/usePresence.ts";
import { DEFAULT_DIFFICULTY, DIFFICULTIES } from "./lib/constants.ts";
import { getDailyResult } from "./lib/daily-streak.ts";
import {
  addFriend,
  getFriends,
  removeFriend as removeFriendFromStorage,
} from "./lib/friends.ts";
import { getLastDifficulty, setLastDifficulty } from "./lib/last-difficulty.ts";
import {
  generateId,
  getPlayerId,
  getPlayerName,
} from "./lib/player-identity.ts";
import { generateRoomCode } from "./lib/room-code.ts";
import { getSoundEnabled, setSoundEnabled } from "./lib/sounds.ts";
import type { AssistLevel, Difficulty } from "./lib/types.ts";
import "./index.css";

type Screen =
  | { name: "landing" }
  | { name: "difficulty"; mode: "solo" | "create" }
  | {
      name: "solo";
      difficulty: Difficulty;
      gameId: number;
      gameKey: string;
      assistLevel: AssistLevel;
    }
  | { name: "daily" }
  | {
      name: "multiplayer";
      roomId: string;
      difficulty: Difficulty;
    }
  | { name: "join" }
  | { name: "stats" }
  | { name: "about" };

const VALID_DIFFICULTIES = new Set<string>(DIFFICULTIES);

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
    case "about":
      return "/about";
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
  if (path === "about") return { name: "about" };

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
        assistLevel: "standard",
      };
    }
    return { name: "landing" };
  }

  // Everything else is treated as a multiplayer roomId
  return {
    name: "multiplayer",
    roomId: path,
    difficulty: DEFAULT_DIFFICULTY,
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

  // Friends & presence
  const playerId = useMemo(getPlayerId, []);
  const playerName = useMemo(getPlayerName, []);
  const [friends, setFriends] = useState(getFriends);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const dailyResult = useMemo(() => {
    const time = getDailyResult(today);
    return time != null ? { date: today, time } : undefined;
  }, [today]);

  const presence = usePresence({
    playerId,
    playerName,
    friends,
    enabled: screen.name === "landing" && friends.length > 0,
    dailyResult,
  });

  const handleAddFriend = useCallback((code: string) => {
    setFriends(addFriend(code, code));
  }, []);

  const handleRemoveFriend = useCallback((friendId: string) => {
    setFriends(removeFriendFromStorage(friendId));
  }, []);

  const handleInviteFriend = useCallback(
    (friendId: string) => {
      const roomId = generateRoomCode();
      presence.sendInvite(friendId, roomId, DEFAULT_DIFFICULTY);
      navigate({ name: "multiplayer", roomId, difficulty: DEFAULT_DIFFICULTY });
    },
    [presence, navigate],
  );

  const handleJoinInvite = useCallback(
    (invite: Invite) => {
      presence.clearInvite(invite.fromId);
      navigate({
        name: "multiplayer",
        roomId: invite.roomId,
        difficulty: invite.difficulty,
      });
    },
    [presence, navigate],
  );

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
            onAbout={() => navigate({ name: "about" })}
            onQuickPlay={() => {
              const difficulty = getLastDifficulty();
              const assistLevel =
                (localStorage.getItem("sudoku_assist_level") as AssistLevel) ??
                "standard";
              gameIdRef.current++;
              navigate({
                name: "solo",
                difficulty,
                gameId: gameIdRef.current,
                gameKey: generateId(),
                assistLevel,
              });
            }}
            lastDifficulty={getLastDifficulty()}
            onContinue={(gameKey, difficulty) => {
              gameIdRef.current++;
              navigate({
                name: "solo",
                difficulty: difficulty as Difficulty,
                gameId: gameIdRef.current,
                gameKey,
                assistLevel: "standard",
              });
            }}
            playerId={playerId}
            friends={friends}
            onlineFriendIds={presence.onlineFriendIds}
            pendingInvites={presence.pendingInvites}
            onAddFriend={handleAddFriend}
            onRemoveFriend={handleRemoveFriend}
            onInviteFriend={handleInviteFriend}
            onJoinInvite={handleJoinInvite}
            friendDailyResults={presence.friendDailyResults}
          />
        </div>
      );

    case "difficulty":
      return (
        <div className="screen">
          <DifficultyPicker
            onSelect={(difficulty, assistLevel) => {
              setLastDifficulty(difficulty);
              if (screen.mode === "solo") {
                gameIdRef.current++;
                navigate({
                  name: "solo",
                  difficulty,
                  gameId: gameIdRef.current,
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
            gameIdRef.current++;
            navigate(
              {
                name: "solo",
                difficulty: screen.difficulty,
                gameId: gameIdRef.current,
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
        <MultiplayerScreen
          roomId={screen.roomId}
          difficulty={screen.difficulty}
          onBack={() => navigate({ name: "landing" })}
          onAddFriend={(opponentId, opponentName) => {
            setFriends(addFriend(opponentId, opponentName));
          }}
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
              difficulty: DEFAULT_DIFFICULTY,
            });
          }}
          onBack={() => navigate({ name: "landing" })}
        />
      );

    case "about":
      return (
        <About
          onBack={() => navigate({ name: "landing" })}
          onPlay={() => navigate({ name: "landing" })}
        />
      );
  }
}

export default App;
