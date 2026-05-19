import { Check, Copy } from "lucide-react";
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
    <div className="screen-content gap-6">
      <h2 className="heading">Game Lobby</h2>

      <div className="card flex w-full flex-col items-center gap-3 p-5">
        <span className="label">Room Code</span>
        <button
          type="button"
          className="press-spring-soft flex items-center gap-2 rounded-xl px-2 py-1 touch-manipulation"
          onClick={async () => {
            await navigator.clipboard.writeText(roomState.roomId);
            setCodeCopied(true);
            setTimeout(() => setCodeCopied(false), 2000);
          }}
          title="Copy room code"
        >
          <span className="font-mono text-2xl font-bold tracking-wide text-text-primary">
            {roomState.roomId}
          </span>
          {codeCopied ? (
            <Check size={16} className="text-accent" aria-hidden="true" />
          ) : (
            <Copy size={16} className="text-text-muted" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-md w-full"
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

      <div className="flex flex-col gap-2.5 w-full">
        <span className="label">Players</span>
        {roomState.players.map((player) => {
          const isMe = player.id === playerId;
          return (
            <div
              key={player.id}
              className="card flex items-center gap-3 px-4 py-3"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: player.color }}
                aria-hidden="true"
              >
                {player.name.charAt(0).toUpperCase()}
              </span>
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
                  className="text-xs font-medium text-text-muted hover:text-accent shrink-0 touch-manipulation"
                  onClick={() => startEditing(player.name)}
                  title="Edit name"
                >
                  Edit
                </button>
              )}
              {player.id === roomState.hostId && (
                <span className="text-[0.625rem] font-semibold uppercase tracking-wide text-accent bg-accent/10 rounded-full px-2 py-0.5 shrink-0 ml-auto">
                  Host
                </span>
              )}
            </div>
          );
        })}
        {waiting && (
          <div className="flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-dashed border-border-default">
            <span className="text-sm text-text-muted">
              Waiting for opponent
            </span>
            <span className="flex gap-1" aria-hidden="true">
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

      {isHost && onDifficultyChange && (
        <div className="flex w-full flex-col gap-2">
          <span className="label">Difficulty</span>
          <SlidingRadioGroup
            options={DIFFICULTY_OPTIONS}
            value={roomState.difficulty}
            onChange={onDifficultyChange}
            name="room-difficulty"
            ariaLabel="Difficulty"
          />
        </div>
      )}

      {onAssistLevelChange && (
        <div className="flex w-full flex-col gap-2">
          <span className="label">Assist</span>
          <AssistLevelPicker
            value={roomState.assistLevel}
            onChange={onAssistLevelChange}
          />
        </div>
      )}

      <div className="flex flex-col gap-3 w-full">
        <button
          type="button"
          disabled={!canStart}
          className={`btn btn-lg w-full ${
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
          className="btn-ghost touch-manipulation"
          onClick={onBack}
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
