import { useCallback, useEffect, useRef, useState } from "react";
import { WebrtcProvider } from "y-webrtc";
import { Doc } from "yjs";
import { SIGNALING_URL } from "../lib/constants.ts";
import type { Friend } from "../lib/friends.ts";
import {
  clearStalePendingInvites,
  getPendingInvites,
  storePendingInvite,
} from "../lib/friends.ts";
import type { Difficulty } from "../lib/types.ts";

export type Invite = {
  roomId: string;
  fromId: string;
  fromName: string;
  difficulty: Difficulty;
  timestamp: number;
};

export type ActiveGame = {
  roomId: string;
  difficulty: string;
  hostName: string;
  timestamp: number;
};

type UsePresenceOptions = {
  playerId: string;
  playerName: string;
  friends: Friend[];
  enabled: boolean;
};

type UsePresenceReturn = {
  onlineFriendIds: Set<string>;
  pendingInvites: Invite[];
  friendActiveGames: Map<string, ActiveGame>;
  sendInvite: (
    targetPlayerId: string,
    roomId: string,
    difficulty: Difficulty,
  ) => void;
  clearInvite: (fromPlayerId: string) => void;
  broadcastGame: (roomId: string, difficulty: string) => void;
  clearGame: () => void;
};

const PRESENCE_ROOM = "dokuel-presence";
const EMPTY_SET = new Set<string>();
const EMPTY_INVITES: Invite[] = [];
const EMPTY_GAMES = new Map<string, ActiveGame>();
const INVITE_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

export function usePresence({
  playerId,
  playerName,
  friends,
  enabled,
}: UsePresenceOptions): UsePresenceReturn {
  const [onlineFriendIds, setOnlineFriendIds] = useState<Set<string>>(
    () => EMPTY_SET,
  );
  const [pendingInvites, setPendingInvites] =
    useState<Invite[]>(EMPTY_INVITES);
  const [friendActiveGames, setFriendActiveGames] =
    useState<Map<string, ActiveGame>>(() => EMPTY_GAMES);

  const docRef = useRef<Doc | null>(null);
  const providerRef = useRef<WebrtcProvider | null>(null);
  const friendIdsRef = useRef<Set<string>>(new Set());

  // Keep friendIds ref in sync
  useEffect(() => {
    friendIdsRef.current = new Set(friends.map((f) => f.playerId));
  }, [friends]);

  useEffect(() => {
    if (!enabled) {
      setOnlineFriendIds(EMPTY_SET);
      setPendingInvites(EMPTY_INVITES);
      setFriendActiveGames(EMPTY_GAMES);
      return;
    }

    const doc = new Doc();
    const provider = new WebrtcProvider(PRESENCE_ROOM, doc, {
      signaling: [SIGNALING_URL],
    });

    docRef.current = doc;
    providerRef.current = provider;

    // Broadcast own identity
    provider.awareness.setLocalStateField("user", {
      id: playerId,
      name: playerName,
    });

    // Track online friends via awareness
    const updateOnlineFriends = () => {
      const states = provider.awareness.getStates();
      const online = new Set<string>();
      for (const [clientId, state] of states) {
        if (clientId === doc.clientID) continue;
        const user = state.user as { id: string } | undefined;
        if (user?.id && friendIdsRef.current.has(user.id)) {
          online.add(user.id);
        }
      }
      setOnlineFriendIds(online);
    };

    provider.awareness.on("change", updateOnlineFriends);

    // Track invites targeting this player
    const invitesMap = doc.getMap("invites");
    const updateInvites = () => {
      const invite = invitesMap.get(playerId) as Invite | undefined;
      if (invite) {
        setPendingInvites([invite]);
      } else {
        setPendingInvites(EMPTY_INVITES);
      }
    };

    invitesMap.observe(updateInvites);
    updateInvites();

    // Track friend active games
    const gamesMap = doc.getMap("games");
    const updateGames = () => {
      const games = new Map<string, ActiveGame>();
      for (const [hostId, value] of gamesMap.entries()) {
        if (hostId === playerId) continue;
        if (friendIdsRef.current.has(hostId)) {
          games.set(hostId, value as ActiveGame);
        }
      }
      setFriendActiveGames(games);
    };

    gamesMap.observe(updateGames);
    updateGames();

    // Re-broadcast stored pending invites on connect
    clearStalePendingInvites(INVITE_MAX_AGE_MS);
    for (const stored of getPendingInvites()) {
      invitesMap.set(stored.targetPlayerId, {
        roomId: stored.roomId,
        fromId: stored.fromId,
        fromName: stored.fromName,
        difficulty: stored.difficulty,
        timestamp: stored.timestamp,
      });
    }

    return () => {
      provider.awareness.off("change", updateOnlineFriends);
      invitesMap.unobserve(updateInvites);
      gamesMap.unobserve(updateGames);
      provider.disconnect();
      provider.destroy();
      doc.destroy();
      docRef.current = null;
      providerRef.current = null;
    };
  }, [enabled, playerId, playerName]);

  const sendInvite = useCallback(
    (targetPlayerId: string, roomId: string, difficulty: Difficulty) => {
      const doc = docRef.current;
      if (!doc) return;
      const invitesMap = doc.getMap("invites");
      const invite = {
        roomId,
        fromId: playerId,
        fromName: playerName,
        difficulty,
        timestamp: Date.now(),
      };
      invitesMap.set(targetPlayerId, invite);

      // Persist for re-broadcasting if we disconnect before friend sees it
      storePendingInvite({
        targetPlayerId,
        ...invite,
      });
    },
    [playerId, playerName],
  );

  const clearInvite = useCallback(
    (fromPlayerId: string) => {
      const doc = docRef.current;
      if (!doc) return;
      // Clear invite targeting us from this sender
      const invitesMap = doc.getMap("invites");
      const invite = invitesMap.get(playerId) as Invite | undefined;
      if (invite?.fromId === fromPlayerId) {
        invitesMap.delete(playerId);
      }
    },
    [playerId],
  );

  const broadcastGame = useCallback(
    (roomId: string, difficulty: string) => {
      const doc = docRef.current;
      if (!doc) return;
      const gamesMap = doc.getMap("games");
      gamesMap.set(playerId, {
        roomId,
        difficulty,
        hostName: playerName,
        timestamp: Date.now(),
      });
    },
    [playerId, playerName],
  );

  const clearGame = useCallback(() => {
    const doc = docRef.current;
    if (!doc) return;
    const gamesMap = doc.getMap("games");
    gamesMap.delete(playerId);
  }, [playerId]);

  return {
    onlineFriendIds,
    pendingInvites,
    friendActiveGames,
    sendInvite,
    clearInvite,
    broadcastGame,
    clearGame,
  };
}
