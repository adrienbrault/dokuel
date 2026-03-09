import { useEffect, useRef, useState } from "react";
import type { Friend } from "../lib/friends.ts";
import type { AssistLevel, RoomState } from "../lib/types.ts";
import { AssistLevelPicker } from "./AssistLevelPicker.tsx";

type LobbyProps = {
  roomState: RoomState;
  playerId?: string;
  onRename?: (name: string) => void;
  onAssistLevelChange?: (level: AssistLevel) => void;
  onStart: () => void;
  onBack: () => void;
  friends?: Friend[];
  onInviteFriend?: (friendId: string) => void;
};

export function Lobby({
  roomState,
  playerId,
  onRename,
  onAssistLevelChange,
  onStart,
  onBack,
  friends,
  onInviteFriend,
}: LobbyProps) {
  const canStart = roomState.players.length === 2;
  const waiting = roomState.players.length < 2;
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const gameUrl = `${window.location.origin}/${roomState.roomId}`;

  useEffect(() => {
    if (editingName) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editingName]);

  function startEditing(currentName: string) {
    setNameInput(currentName);
    setEditingName(true);
  }

  function commitName() {
    const trimmed = nameInput.trim();
    if (trimmed && onRename) {
      onRename(trimmed);
    }
    setEditingName(false);
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ url: gameUrl });
        return;
      } catch {
        // User cancelled or share failed, fall through to clipboard
      }
    }
    await navigator.clipboard.writeText(gameUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="screen-content gap-8">
      <div className="flex flex-col items-center gap-2">
        <h2 className="heading">Game Lobby</h2>
        <button
          type="button"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-raised cursor-pointer touch-manipulation press-spring-soft"
          onClick={async () => {
            await navigator.clipboard.writeText(roomState.roomId);
            setCodeCopied(true);
            setTimeout(() => setCodeCopied(false), 2000);
          }}
          title="Copy room code"
        >
          <span className="caption">{codeCopied ? "Copied!" : "Room:"}</span>
          <span className="font-mono font-semibold text-text-primary">
            {roomState.roomId}
          </span>
        </button>
        <button
          type="button"
          className="btn btn-md btn-primary mt-1 shadow-sm shadow-accent/20"
          onClick={handleShare}
        >
          {copied ? "Link Copied!" : "Share Invite Link"}
        </button>
      </div>

      <div className="flex flex-col gap-3 w-full">
        <h3 className="label tracking-wide">Players</h3>
        {roomState.players.map((player) => {
          const isMe = player.id === playerId;
          return (
            <div
              key={player.id}
              className="card flex items-center gap-3 px-4 py-3"
            >
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: player.color }}
              />
              {isMe && editingName ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onBlur={commitName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitName();
                    if (e.key === "Escape") setEditingName(false);
                  }}
                  maxLength={24}
                  className="font-medium text-text-primary bg-transparent border-b-2 border-accent outline-none min-w-0 flex-1"
                />
              ) : (
                <button
                  type="button"
                  className={`font-medium text-text-primary text-left truncate ${isMe ? "cursor-pointer hover:underline decoration-accent decoration-2 underline-offset-2" : "cursor-default"}`}
                  onClick={() => {
                    if (isMe) startEditing(player.name);
                  }}
                  title={isMe ? "Click to change name" : undefined}
                >
                  {player.name}
                </button>
              )}
              {isMe && !editingName && (
                <button
                  type="button"
                  className="text-xs text-text-muted hover:text-accent shrink-0 touch-manipulation"
                  onClick={() => startEditing(player.name)}
                  title="Edit name"
                >
                  Edit
                </button>
              )}
              {player.id === roomState.hostId && (
                <span className="text-xs text-text-muted shrink-0 ml-auto">
                  Host
                </span>
              )}
            </div>
          );
        })}
        {waiting && (
          <div className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-accent/30">
            <span className="text-sm text-text-secondary">
              Waiting for opponent
            </span>
            <span className="flex gap-0.5" aria-hidden="true">
              <span
                className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </span>
          </div>
        )}
      </div>

      {waiting &&
        friends &&
        friends.length > 0 &&
        onInviteFriend && (
          <div className="flex flex-col gap-2 w-full">
            <h3 className="label tracking-wide">Invite a Friend</h3>
            {friends.map((friend) => (
              <div
                key={friend.playerId}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-bg-raised"
              >
                <span className="text-sm text-text-primary font-medium truncate">
                  {friend.name}
                </span>
                <button
                  type="button"
                  className="btn btn-md btn-primary"
                  onClick={() => onInviteFriend(friend.playerId)}
                  aria-label={`Invite ${friend.name}`}
                >
                  Invite
                </button>
              </div>
            ))}
          </div>
        )}

      {onAssistLevelChange && (
        <AssistLevelPicker
          value={roomState.assistLevel}
          onChange={onAssistLevelChange}
        />
      )}

      <div className="flex flex-col gap-3 w-full">
        <button
          type="button"
          disabled={!canStart}
          className={`btn btn-lg w-full transition-all duration-100 ${
            canStart
              ? "btn-primary"
              : "bg-bg-disabled text-text-disabled cursor-not-allowed"
          }`}
          onClick={onStart}
        >
          Start Game
        </button>
        <button
          type="button"
          className="btn-ghost mt-2 touch-manipulation"
          onClick={onBack}
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
