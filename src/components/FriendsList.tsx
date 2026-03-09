import { useState } from "react";
import type { Invite } from "../hooks/usePresence.ts";
import type { Friend } from "../lib/friends.ts";

type FriendsListProps = {
  playerId: string;
  friends: Friend[];
  onlineFriendIds: Set<string>;
  pendingInvites: Invite[];
  onAddFriend: (code: string) => void;
  onRemoveFriend: (playerId: string) => void;
  onInviteFriend: (friendId: string) => void;
  onJoinInvite: (invite: Invite) => void;
};

export function FriendsList({
  playerId,
  friends,
  onlineFriendIds,
  pendingInvites,
  onAddFriend,
  onRemoveFriend,
  onInviteFriend,
  onJoinInvite,
}: FriendsListProps) {
  const [friendCode, setFriendCode] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(playerId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddFriend = () => {
    const code = friendCode.trim();
    if (code && code !== playerId) {
      onAddFriend(code);
      setFriendCode("");
    }
  };

  // Sort: online first, then alphabetical
  const sortedFriends = [...friends].sort((a, b) => {
    const aOnline = onlineFriendIds.has(a.playerId);
    const bOnline = onlineFriendIds.has(b.playerId);
    if (aOnline !== bOnline) return aOnline ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex flex-col gap-3">
      <span className="label">Friends</span>

      {/* Your friend code */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-text-muted">Your code:</span>
        <button
          type="button"
          className="font-mono text-sm text-accent hover:text-accent/80 transition-colors"
          onClick={handleCopyCode}
          aria-label="Copy friend code"
        >
          {playerId}
          {copied ? " (copied!)" : ""}
        </button>
      </div>

      {/* Add friend input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={friendCode}
          onChange={(e) => setFriendCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddFriend()}
          placeholder="Enter friend code"
          className="flex-1 px-3 py-2 text-sm rounded-lg bg-bg-inset border border-border-default text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30"
          maxLength={12}
          aria-label="Friend code input"
        />
        <button
          type="button"
          className="btn btn-md btn-secondary"
          onClick={handleAddFriend}
          disabled={!friendCode.trim() || friendCode.trim() === playerId}
        >
          Add
        </button>
      </div>

      {/* Pending invites */}
      {pendingInvites.map((invite) => (
        <div
          key={invite.fromId}
          className="flex items-center justify-between px-3 py-2 rounded-lg bg-accent/10 border border-accent/20"
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-sm text-text-primary font-medium">
              {invite.fromName}
            </span>
            <span className="text-xs text-text-muted">invited you</span>
          </div>
          <button
            type="button"
            className="btn btn-md btn-primary"
            onClick={() => onJoinInvite(invite)}
            aria-label={`Join ${invite.fromName}'s game`}
          >
            Join
          </button>
        </div>
      ))}

      {/* Friends list */}
      {sortedFriends.map((friend) => {
        const isOnline = onlineFriendIds.has(friend.playerId);
        return (
          <div
            key={friend.playerId}
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-bg-raised"
          >
            <div className="flex items-center gap-2">
              <span
                role="img"
                className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-500" : "bg-text-muted/30"}`}
                aria-label={isOnline ? "Online" : "Offline"}
              />
              <span className="text-sm text-text-primary">{friend.name}</span>
            </div>
            <div className="flex items-center gap-1">
              {isOnline && (
                <button
                  type="button"
                  className="btn btn-md btn-primary"
                  onClick={() => onInviteFriend(friend.playerId)}
                  aria-label={`Invite ${friend.name}`}
                >
                  Invite
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost px-3 py-3.5 text-text-muted"
                onClick={() => onRemoveFriend(friend.playerId)}
                aria-label={`Remove ${friend.name}`}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        );
      })}

      {friends.length === 0 && pendingInvites.length === 0 && (
        <p className="text-xs text-text-muted text-center">
          Share your code with a friend to get started.
        </p>
      )}
    </div>
  );
}
