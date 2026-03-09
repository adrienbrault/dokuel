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
  const [expanded, setExpanded] = useState(false);

  const onlineCount = friends.filter((f) =>
    onlineFriendIds.has(f.playerId),
  ).length;

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

      {/* Compact button row */}
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-lg btn-secondary flex-1 min-w-0"
          onClick={handleCopyCode}
          aria-label="Copy friend code"
        >
          <span className="flex items-center justify-center gap-2">
            {copied ? (
              <>
                <CopyCheckIcon />
                <span className="text-sm">Copied!</span>
              </>
            ) : (
              <>
                <CopyIcon />
                <span className="font-mono text-sm truncate">{playerId}</span>
              </>
            )}
          </span>
        </button>
        <button
          type="button"
          className="btn btn-lg btn-secondary flex-1 min-w-0"
          onClick={() => setExpanded(!expanded)}
          aria-label="Toggle friends list"
          aria-expanded={expanded}
        >
          <span className="flex items-center justify-center gap-2">
            <FriendsIcon />
            <span className="text-sm">
              {friends.length === 0
                ? "Add Friend"
                : `${friends.length} Friend${friends.length !== 1 ? "s" : ""}`}
            </span>
            {onlineCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-xs text-text-muted">{onlineCount}</span>
              </span>
            )}
            <ChevronIcon expanded={expanded} />
          </span>
        </button>
      </div>

      {/* Pending invites — always visible */}
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

      {/* Expandable section */}
      {expanded && (
        <div className="flex flex-col gap-3">
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
                  <span className="text-sm text-text-primary">
                    {friend.name}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className={`btn btn-md ${isOnline ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => onInviteFriend(friend.playerId)}
                    aria-label={`Invite ${friend.name}`}
                  >
                    Invite
                  </button>
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

          {friends.length === 0 && (
            <p className="text-xs text-text-muted text-center">
              Share your code with a friend to get started.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function CopyIcon() {
  return (
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
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function CopyCheckIcon() {
  return (
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
      className="text-emerald-500"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function FriendsIcon() {
  return (
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
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`transition-transform ${expanded ? "rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
