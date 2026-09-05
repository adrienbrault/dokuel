import { MAX_ROOM_KEY_LENGTH } from "../hooks/mp-connection.ts";
import {
  challengePath,
  type FriendChallenge,
  parseChallenge,
} from "./challenge.ts";
import { isCalendarDate } from "./date.ts";
import {
  type FriendReceipt,
  type FriendRoundMode,
  friendReceiptPath,
  parseFriendReceipt,
  type ReceiptSide,
} from "./friend-receipt.ts";
import type { AssistLevel, Difficulty } from "./types.ts";

export type Screen =
  | { name: "challenge"; challenge: FriendChallenge }
  | { name: "receipt"; receipt: FriendReceipt }
  | {
      name: "friendRound";
      receipt: FriendReceipt;
      side: ReceiptSide;
      mode: FriendRoundMode;
    }
  | { name: "landing" }
  | { name: "difficulty"; mode: "solo" | "create" }
  | {
      name: "solo";
      difficulty: Difficulty;
      gameKey: string;
      assistLevel: AssistLevel;
    }
  | { name: "daily"; date?: string | undefined }
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
      return `/solo/${screen.difficulty}/${screen.gameKey}`;
    case "challenge":
      return challengePath(screen.challenge);
    case "receipt":
      return friendReceiptPath(screen.receipt);
    case "friendRound":
      return `${friendReceiptPath(screen.receipt).replace("/receipt/", "/friend-round/")}/${screen.side}/${screen.mode}`;
    case "daily":
      return screen.date ? `/daily/${screen.date}` : "/daily";
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

export function pathToScreen(pathname: string): Screen {
  const path = pathname.replace(/^\/+|\/+$/g, "");

  if (path === "") return { name: "landing" };
  if (path === "daily") return { name: "daily" };
  if (path.startsWith("daily/")) {
    const date = path.slice(6);
    return isCalendarDate(date)
      ? { name: "daily", date }
      : { name: "notFound", path: pathname };
  }
  if (path === "join") return { name: "join" };
  if (path === "stats") return { name: "stats" };

  if (path.startsWith("challenge/")) {
    const challenge = parseChallenge(path.slice("challenge/".length));
    return challenge
      ? { name: "challenge", challenge }
      : { name: "notFound", path: pathname };
  }

  if (path.startsWith("receipt/")) {
    const receipt = parseFriendReceipt(path.slice("receipt/".length));
    return receipt
      ? { name: "receipt", receipt }
      : { name: "notFound", path: pathname };
  }

  if (path.startsWith("friend-round/")) {
    const parts = path.slice("friend-round/".length).split("/");
    const payload = parts[0] ?? "";
    const side = parts[1];
    const mode = parts[2];
    const receipt = parts.length === 3 ? parseFriendReceipt(payload) : null;
    if (
      receipt &&
      (side === "challenger" || side === "friend") &&
      (mode === "again" || mode === "bestOfThree")
    ) {
      return {
        name: "friendRound",
        receipt,
        side,
        mode,
      };
    }
    return { name: "notFound", path: pathname };
  }

  if (path.startsWith("solo/")) {
    const parts = path.slice(5).split("/");
    const difficulty = parts[0] ?? "";
    const gameKey = parts[1] ?? "";
    if (VALID_DIFFICULTIES.has(difficulty) && gameKey) {
      return {
        name: "solo",
        difficulty: difficulty as Difficulty,
        gameKey,
        assistLevel: "standard",
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
