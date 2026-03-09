import { useCallback, useEffect, useRef, useState } from "react";
import { WebrtcProvider } from "y-webrtc";
import { Doc } from "yjs";
import { SIGNALING_URL } from "../lib/constants.ts";
import type { Friend } from "../lib/friends.ts";
import type { Difficulty } from "../lib/types.ts";

export type Invite = {
  roomId: string;
  fromId: string;
  fromName: string;
  difficulty: Difficulty;
  timestamp: number;
};

export type FriendDailyResult = {
  playerId: string;
  playerName: string;
  time: number;
};

type UsePresenceOptions = {
  playerId: string;
  playerName: string;
  friends: Friend[];
  enabled: boolean;
  dailyResult?: { date: string; time: number } | undefined;
};

type UsePresenceReturn = {
  onlineFriendIds: Set<string>;
  pendingInvites: Invite[];
  friendDailyResults: FriendDailyResult[];
  sendInvite: (
    targetPlayerId: string,
    roomId: string,
    difficulty: Difficulty,
  ) => void;
  clearInvite: (fromPlayerId: string) => void;
};

const PRESENCE_ROOM = "dokuel-presence";
const EMPTY_SET = new Set<string>();
const EMPTY_INVITES: Invite[] = [];

const EMPTY_DAILY_RESULTS: FriendDailyResult[] = [];

export function usePresence({
  playerId,
  playerName,
  friends,
  enabled,
  dailyResult,
}: UsePresenceOptions): UsePresenceReturn {
  const [onlineFriendIds, setOnlineFriendIds] = useState<Set<string>>(
    () => EMPTY_SET,
  );
  const [pendingInvites, setPendingInvites] = useState<Invite[]>(EMPTY_INVITES);
  const [friendDailyResults, setFriendDailyResults] =
    useState<FriendDailyResult[]>(EMPTY_DAILY_RESULTS);

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
      setFriendDailyResults(EMPTY_DAILY_RESULTS);
      return;
    }

    const doc = new Doc();
    const provider = new WebrtcProvider(PRESENCE_ROOM, doc, {
      signaling: [SIGNALING_URL],
    });

    docRef.current = doc;
    providerRef.current = provider;

    // Broadcast own identity and daily result
    provider.awareness.setLocalStateField("user", {
      id: playerId,
      name: playerName,
      dailyResult: dailyResult ?? null,
    });

    // Track online friends and their daily results via awareness
    const todayStr = new Date().toISOString().slice(0, 10);
    const updateOnlineFriends = () => {
      const states = provider.awareness.getStates();
      const online = new Set<string>();
      const dailyResults: FriendDailyResult[] = [];
      for (const [clientId, state] of states) {
        if (clientId === doc.clientID) continue;
        const user = state.user as
          | {
              id: string;
              name: string;
              dailyResult?: { date: string; time: number } | null;
            }
          | undefined;
        if (user?.id && friendIdsRef.current.has(user.id)) {
          online.add(user.id);
          if (user.dailyResult && user.dailyResult.date === todayStr) {
            dailyResults.push({
              playerId: user.id,
              playerName: user.name,
              time: user.dailyResult.time,
            });
          }
        }
      }
      setOnlineFriendIds(online);
      setFriendDailyResults(
        dailyResults.length > 0
          ? dailyResults.sort((a, b) => a.time - b.time)
          : EMPTY_DAILY_RESULTS,
      );
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

    return () => {
      provider.awareness.off("change", updateOnlineFriends);
      invitesMap.unobserve(updateInvites);
      provider.disconnect();
      provider.destroy();
      doc.destroy();
      docRef.current = null;
      providerRef.current = null;
    };
  }, [enabled, playerId, playerName, dailyResult]);

  const sendInvite = useCallback(
    (targetPlayerId: string, roomId: string, difficulty: Difficulty) => {
      const doc = docRef.current;
      if (!doc) return;
      const invitesMap = doc.getMap("invites");
      invitesMap.set(targetPlayerId, {
        roomId,
        fromId: playerId,
        fromName: playerName,
        difficulty,
        timestamp: Date.now(),
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

  return {
    onlineFriendIds,
    pendingInvites,
    friendDailyResults,
    sendInvite,
    clearInvite,
  };
}
