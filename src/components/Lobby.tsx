import { useEffect, useRef, useState } from "react";
import { DIFFICULTY_OPTIONS } from "../lib/constants.ts";
import type { AssistLevel, Difficulty, RoomState } from "../lib/types.ts";
import { AssistLevelPicker } from "./AssistLevelPicker.tsx";
import { SlidingRadioGroup } from "./SlidingRadioGroup.tsx";

type LobbyProps = {
  roomState: RoomState;
  playerId?: string;
  onRename?: (name: string) => void;
  onAssistLevelChange?: (level: AssistLevel) => void;
  onDifficultyChange?: (level: Difficulty) => void;
  onStart: () => void;
  onBack: () => void;
};

export function Lobby({
  roomState,
  playerId,
  onRename,
  onAssistLevelChange,
  onDifficultyChange,
  onStart,
  onBack,
}: LobbyProps) {
  const isHost = playerId !== undefined && playerId === roomState.hostId;
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
    <div className="screen-content gap-7 py-10">
      <div className="flex flex-col items-center gap-3">
        <h2 className="heading">Game Lobby</h2>
        <button
          type="button"
          className="card flex items-center gap-2 px-4 py-2.5 cursor-pointer touch-manipulation press-spring-soft"
          onClick={async () => {
            await navigator.clipboard.writeText(roomState.roomId);
            setCodeCopied(true);
            setTimeout(() => setCodeCopied(false), 2000);
          }}
          title="Copy room code"
        >
          <span className="label">{codeCopied ? "Copied!" : "Room"}</span>
          <span className="font-mono font-bold text-text-primary tracking-wide">
            {roomState.roomId}
          </span>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-text-muted"
            aria-hidden="true"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
        <button
          type="button"
          className="btn btn-md btn-primary mt-0.5"
          onClick={handleShare}
        >
          {copied ? "Link Copied!" : "Share Invite Link"}
        </button>
        <p className="caption">
          Difficulty:{" "}
          <span className="font-semibold text-text-primary capitalize">
            {roomState.difficulty}
          </span>
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full">
        <h3 className="label">Players</h3>
        {roomState.players.map((player) => {
          const isMe = player.id === playerId;
          return (
            <div
              key={player.id}
              className="card flex items-center gap-3 px-4 py-3.5"
            >
              <div
                className="w-3.5 h-3.5 rounded-full shrink-0 ring-2 ring-bg-raised"
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
          <div className="flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-dashed border-border-default animate-pulse">
            <span className="text-sm text-text-muted">
              Waiting for opponent
            </span>
            <span className="flex gap-0.5" aria-hidden="true">
              <span
                className="w-1 h-1 rounded-full bg-text-muted animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="w-1 h-1 rounded-full bg-text-muted animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="w-1 h-1 rounded-full bg-text-muted animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </span>
          </div>
        )}
      </div>

      {isHost && onDifficultyChange && (
        <SlidingRadioGroup
          options={DIFFICULTY_OPTIONS}
          value={roomState.difficulty}
          onChange={onDifficultyChange}
          name="room-difficulty"
          ariaLabel="Difficulty"
        />
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
          className={`btn btn-lg w-full ${
            canStart ? "btn-primary" : "bg-bg-disabled text-text-disabled"
          }`}
          onClick={onStart}
        >
          Start Game
        </button>
        <button
          type="button"
          className="btn btn-ghost touch-manipulation"
          onClick={onBack}
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
