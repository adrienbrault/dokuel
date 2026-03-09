import { useCallback, useMemo, useState } from "react";
import type { Friend } from "../lib/friends.ts";
import {
  getPlayerId,
  getPlayerName,
  persistPlayerName,
} from "../lib/player-identity.ts";
import type { Difficulty } from "../lib/types.ts";
import { MultiplayerGame } from "./MultiplayerGame.tsx";

export function MultiplayerScreen({
  roomId,
  difficulty,
  onBack,
  onAddFriend,
  friends,
  onInviteFriendToRoom,
}: {
  roomId: string;
  difficulty: Difficulty;
  onBack: () => void;
  onAddFriend?:
    | ((opponentId: string, opponentName: string) => void)
    | undefined;
  friends?: Friend[] | undefined;
  onInviteFriendToRoom?: ((friendId: string) => void) | undefined;
}) {
  const playerId = useMemo(getPlayerId, []);
  const [playerName, setName] = useState(getPlayerName);

  const handleRename = useCallback((name: string) => {
    setName(name);
    persistPlayerName(name);
  }, []);

  return (
    <MultiplayerGame
      roomId={roomId}
      playerId={playerId}
      playerName={playerName}
      onRename={handleRename}
      difficulty={difficulty}
      onBack={onBack}
      onAddFriend={onAddFriend}
      friends={friends}
      onInviteFriendToRoom={onInviteFriendToRoom}
    />
  );
}
