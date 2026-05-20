import { Check, Copy, Pencil, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DIFFICULTY_LABELS, DIFFICULTY_OPTIONS } from "../lib/constants.ts";
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

  const showDifficultyControl = isHost && onDifficultyChange;

  return (
    <div className="screen-content gap-6 py-8">
      <div className="flex flex-col items-center gap-3 w-full">
        <h2 className="heading">Game Lobby</h2>
        <button
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-bg-raised border border-border-default press-spring-soft touch-manipulation"
          onClick={async () => {
            await navigator.clipboard.writeText(roomState.roomId);
            setCodeCopied(true);
            setTimeout(() => setCodeCopied(false), 2000);
          }}
          title="Copy room code"
        >
          <span className="font-mono font-bold text-text-primary tracking-wide">
            {roomState.roomId}
          </span>
          {codeCopied ? (
            <Check size={15} className="text-success" aria-hidden="true" />
          ) : (
            <Copy size={15} className="text-text-muted" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          className="btn btn-md btn-primary flex items-center gap-2"
          onClick={handleShare}
        >
          <Share2 size={16} strokeWidth={2.2} aria-hidden="true" />
          {copied ? "Link Copied!" : "Share Invite Link"}
        </button>
      </div>

      <div className="flex flex-col gap-2 w-full">
        <span className="label">Players</span>
        {roomState.players.map((player) => {
          const isMe = player.id === playerId;
          return (
            <div
              key={player.id}
              className="card flex items-center gap-3 px-3.5 py-3"
            >
              <span
                className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: player.color }}
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
                  className="font-semibold text-text-primary bg-transparent border-b-2 border-accent outline-none min-w-0 flex-1"
                />
              ) : (
                <button
                  type="button"
                  className={`font-semibold text-text-primary text-left truncate flex-1 ${isMe ? "cursor-pointer" : "cursor-default"}`}
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
                  className="flex items-center justify-center w-7 h-7 rounded-lg text-text-muted hover:text-accent hover:bg-bg-raised transition-colors shrink-0 touch-manipulation"
                  onClick={() => startEditing(player.name)}
                  title="Edit name"
                  aria-label="Edit name"
                >
                  <Pencil size={14} aria-hidden="true" />
                </button>
              )}
              {player.id === roomState.hostId && (
                <span className="text-[0.625rem] font-bold uppercase tracking-wider text-accent bg-accent-soft px-2 py-1 rounded-full shrink-0">
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
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 w-full">
        <span className="label">Difficulty</span>
        {showDifficultyControl ? (
          <SlidingRadioGroup
            options={DIFFICULTY_OPTIONS}
            value={roomState.difficulty}
            onChange={onDifficultyChange}
            name="room-difficulty"
            ariaLabel="Difficulty"
          />
        ) : (
          <div className="card px-4 py-2.5">
            <span className="text-sm font-semibold text-text-primary capitalize">
              {DIFFICULTY_LABELS[roomState.difficulty]}
            </span>
          </div>
        )}
      </div>

      {onAssistLevelChange && (
        <div className="flex flex-col gap-2 w-full">
          <span className="label">Assistance</span>
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
          className="btn btn-ghost touch-manipulation"
          onClick={onBack}
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
