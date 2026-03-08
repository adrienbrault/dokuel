import { useState } from "react";
import type { RoomState } from "../lib/types.ts";

type LobbyProps = {
  roomState: RoomState;
  playerId: string;
  onStart: () => void;
  onBack: () => void;
};

export function Lobby({ roomState, playerId, onStart, onBack }: LobbyProps) {
  const isHost = playerId === roomState.hostId;
  const canStart = isHost && roomState.players.length === 2;
  const waiting = roomState.players.length < 2;
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const gameUrl = `${window.location.origin}/${roomState.roomId}`;

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
    <div className="flex flex-col items-center gap-8 w-full max-w-sm px-6">
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Game Lobby
        </h2>
        <button
          type="button"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 cursor-pointer touch-manipulation press-spring-soft"
          onClick={async () => {
            await navigator.clipboard.writeText(roomState.roomId);
            setCodeCopied(true);
            setTimeout(() => setCodeCopied(false), 2000);
          }}
          title="Copy room code"
        >
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {codeCopied ? "Copied!" : "Room:"}
          </span>
          <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">
            {roomState.roomId}
          </span>
        </button>
        <button
          type="button"
          className="mt-1 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white shadow-sm shadow-accent/20 press-spring-soft select-none touch-manipulation"
          onClick={handleShare}
        >
          {copied ? "Link Copied!" : "Share Invite Link"}
        </button>
      </div>

      <div className="flex flex-col gap-3 w-full">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Players
        </h3>
        {roomState.players.map((player) => (
          <div
            key={player.id}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
          >
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: player.color }}
            />
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {player.name}
            </span>
            {player.id === roomState.hostId && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                Host
              </span>
            )}
          </div>
        ))}
        {waiting && (
          <div className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 animate-pulse">
            <span className="text-sm text-gray-400 dark:text-gray-500">
              Waiting for opponent
            </span>
            <span className="flex gap-0.5" aria-hidden="true">
              <span
                className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 w-full">
        {isHost && (
          <button
            type="button"
            disabled={!canStart}
            className={`
							w-full py-4 rounded-xl text-lg font-semibold
							transition-all duration-100 select-none touch-manipulation
							active:scale-[0.98]
							${
                canStart
                  ? "bg-accent text-white shadow-lg shadow-accent/20"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              }
						`}
            onClick={onStart}
          >
            Start Game
          </button>
        )}
        <button
          type="button"
          className="text-sm text-gray-400 dark:text-gray-500 mt-2 touch-manipulation"
          onClick={onBack}
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
