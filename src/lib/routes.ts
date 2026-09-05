import { MAX_ROOM_KEY_LENGTH } from "../hooks/mp-connection.ts";
import {
  challengeQuery,
  parseChallenge,
  type SoloChallenge,
} from "./challenge.ts";
import type { AssistLevel, Difficulty } from "./types.ts";

/**
 * The app's routing table: every screen the URL can name, and the
 * two total functions between a location and a screen. Kept out of
 * App so the mapping can be read - and tested - without a renderer.
 */
export type Screen =
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
