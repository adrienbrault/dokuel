import { useCallback, useEffect, useRef, useState } from "react";
import { WebrtcProvider } from "y-webrtc";
import * as Y from "yjs";
import type { Friend } from "../lib/friends.ts";
import type { Difficulty } from "../lib/types.ts";

export type Invite = {
  roomId: string;
  fromId: string;
  fromName: string;
  difficulty: Difficulty;
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

  const docRef = useRef<Y.Doc | null>(null);
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
      return;
    }

    const doc = new Y.Doc();
    const provider = new WebrtcProvider(PRESENCE_ROOM, doc, {
      signaling: ["wss://signal.dokuel.com"],
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

    return () => {
      provider.awareness.off("change", updateOnlineFriends);
      invitesMap.unobserve(updateInvites);
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

  return { onlineFriendIds, pendingInvites, sendInvite, clearInvite };
}
