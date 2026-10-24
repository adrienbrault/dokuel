import { Copy } from "lucide-react";
import { useState } from "react";
import { useDigitColorMode } from "../hooks/useDigitColorMode.ts";
import { useEmojiTheme } from "../hooks/useEmojiTheme.ts";
import { DIFFICULTY_OPTIONS } from "../lib/constants.ts";
import { describeDigitStyle } from "../lib/digit-style.ts";
import { teamsReady } from "../lib/teams.ts";
import type {
  AssistLevel,
  Difficulty,
  DigitStyle,
  RoomMode,
  RoomState,
  Team,
} from "../lib/types.ts";
import { AssistLevelPicker } from "./AssistLevelPicker.tsx";
import { DigitColorPicker } from "./DigitColorPicker.tsx";
import { EmojiThemePicker } from "./EmojiThemePicker.tsx";
import { LobbyPlayers } from "./LobbyPlayers.tsx";
import { SlidingRadioGroup } from "./SlidingRadioGroup.tsx";
import { ToggleSwitch } from "./ToggleSwitch.tsx";

type LobbyProps = {
  roomState: RoomState;
  playerId?: string;
  onRename?: (name: string) => void;
  onAssistLevelChange?: (level: AssistLevel) => void;
  onDifficultyChange?: (level: Difficulty) => void;
  /** Host only: pins one palette for every board, or frees them with null. */
  onDigitStyleChange?: (style: DigitStyle | null) => void;
  /** Host only: free-for-all or two teams of two. */
  onModeChange?: (mode: RoomMode) => void;
  onTeamChange?: (team: Team) => void;
  onStart: () => void;
  onBack: () => void;
};

export function Lobby({
  roomState,
  playerId,
  onRename,
  onAssistLevelChange,
  onDifficultyChange,
  onDigitStyleChange,
  onModeChange,
  onTeamChange,
  onStart,
  onBack,
}: LobbyProps) {
  const isHost = playerId !== undefined && playerId === roomState.hostId;
  const canStart =
    roomState.mode === "teams"
      ? teamsReady(roomState.players)
      : roomState.players.length >= 2;
  const pinnedStyle = roomState.digitStyle;
  // Overridden by the room's pick when there is one, so the pickers
  // below show what the guest will actually see; otherwise they show
  // what the host plays with on their own, which is what the toggle
  // seeds the room from.
  const digitColor = useDigitColorMode(pinnedStyle?.mode ?? null);
  const emojiTheme = useEmojiTheme(pinnedStyle?.emojiTheme ?? null);
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
    try {
      await navigator.clipboard.writeText(gameUrl);
    } catch {
      // Copy failed (permissions, lost activation) — don't claim it
      // worked, and don't surface an unhandled rejection.
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="screen-content gap-7 py-10 short:gap-4 short:py-5">
      <div className="flex flex-col items-center gap-3">
        <h2 className="heading">Game Lobby</h2>
        <button
          type="button"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-inset border border-border-default cursor-pointer touch-manipulation press-spring-soft"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(roomState.roomId);
            } catch {
              return;
            }
            setCodeCopied(true);
            setTimeout(() => setCodeCopied(false), 2000);
          }}
          title="Copy room code"
        >
          <Copy size={14} className="text-text-muted" aria-hidden="true" />
          <span className="caption">{codeCopied ? "Copied!" : "Room"}</span>
          <span className="font-mono font-bold text-text-primary">
            {roomState.roomId}
          </span>
        </button>
        <button
          type="button"
          className="btn btn-md btn-primary"
          onClick={handleShare}
        >
          {copied ? "Link Copied!" : "Share Invite Link"}
        </button>
      </div>

      {isHost && onModeChange ? (
        <div className="w-full">
          <ToggleSwitch
            checked={roomState.mode === "teams"}
            onChange={() =>
              onModeChange(roomState.mode === "teams" ? "ffa" : "teams")
            }
            label="2v2 teams"
          />
        </div>
      ) : (
        roomState.mode === "teams" && (
          <p className="caption w-full">
            2v2 teams: two players share each board
          </p>
        )
      )}

      <LobbyPlayers
        roomState={roomState}
        playerId={playerId}
        onRename={onRename}
        onTeamChange={onTeamChange}
      />

      <div className="flex flex-col gap-2 w-full">
        <span className="label">Difficulty</span>
        {isHost && onDifficultyChange ? (
          <SlidingRadioGroup
            options={DIFFICULTY_OPTIONS}
            value={roomState.difficulty}
            onChange={onDifficultyChange}
            name="room-difficulty"
            ariaLabel="Difficulty"
          />
        ) : (
          <div className="card px-4 py-2.5 text-center text-sm font-semibold text-text-primary capitalize">
            {roomState.difficulty}
          </div>
        )}
      </div>

      {isHost && onDigitStyleChange ? (
        <div className="flex flex-col gap-2 w-full">
          <ToggleSwitch
            checked={pinnedStyle !== null}
            onChange={() =>
              onDigitStyleChange(
                pinnedStyle === null
                  ? { mode: digitColor.mode, emojiTheme: emojiTheme.theme }
                  : null,
              )
            }
            label="Same digits for everyone"
          />
          {pinnedStyle !== null && (
            <>
              <DigitColorPicker
                mode={pinnedStyle.mode}
                onChange={(mode) =>
                  onDigitStyleChange({
                    mode,
                    emojiTheme: pinnedStyle.emojiTheme,
                  })
                }
              />
              {pinnedStyle.mode === "emoji" && (
                <EmojiThemePicker
                  theme={pinnedStyle.emojiTheme}
                  onChange={(theme) =>
                    onDigitStyleChange({
                      mode: pinnedStyle.mode,
                      emojiTheme: theme,
                    })
                  }
                />
              )}
            </>
          )}
        </div>
      ) : (
        pinnedStyle !== null && (
          <div className="flex flex-col gap-2 w-full">
            <span className="label">Digits</span>
            <div className="card px-4 py-2.5 text-center text-sm font-semibold text-text-primary">
              {describeDigitStyle(pinnedStyle)}
            </div>
          </div>
        )
      )}

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
