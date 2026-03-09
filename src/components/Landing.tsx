import { useCallback, useMemo, useState } from "react";
import type { FriendDailyResult, Invite } from "../hooks/usePresence.ts";
import { DIFFICULTY_LABELS } from "../lib/constants.ts";
import { getDailyStreak, isDailyCompleted } from "../lib/daily-streak.ts";
import { formatShortDate, formatTime, getTodayISO } from "../lib/format.ts";
import type { Friend } from "../lib/friends.ts";
import {
  deleteGame,
  listSavedGames,
  loadGame,
  type SavedGameSummary,
} from "../lib/game-storage.ts";
import { getStats } from "../lib/stats.ts";
import { countFilledCells } from "../lib/sudoku.ts";
import { DemoBoard } from "./DemoBoard.tsx";
import { FriendsList } from "./FriendsList.tsx";
import { ActionButton, GitHubIcon, StatsIcon } from "./LandingIcons.tsx";

type LandingProps = {
  onSolo: () => void;
  onDaily: () => void;
  onCreate: () => void;
  onJoin: () => void;
  onContinue: (gameKey: string, difficulty: string) => void;
  onStats: () => void;
  onAbout: () => void;
  onQuickPlay?: (() => void) | undefined;
  lastDifficulty?: import("../lib/types.ts").Difficulty | undefined;
  playerId?: string;
  friends?: Friend[];
  onlineFriendIds?: Set<string>;
  pendingInvites?: Invite[];
  onAddFriend?: (code: string) => void;
  onRemoveFriend?: (playerId: string) => void;
  onInviteFriend?: (friendId: string) => void;
  onJoinInvite?: (invite: Invite) => void;
  friendDailyResults?: FriendDailyResult[] | undefined;
};

export function Landing({
  onSolo,
  onDaily,
  onCreate,
  onJoin,
  onContinue,
  onStats,
  onAbout,
  onQuickPlay,
  lastDifficulty,
  playerId,
  friends,
  onlineFriendIds,
  pendingInvites,
  onAddFriend,
  onRemoveFriend,
  onInviteFriend,
  onJoinInvite,
  friendDailyResults,
}: LandingProps) {
  const today = useMemo(() => getTodayISO(), []);
  const completed = useMemo(() => isDailyCompleted(today), [today]);
  const streak = useMemo(() => getDailyStreak(), []);
  const [savedGames, setSavedGames] = useState(() => listSavedGames());
  const dailyProgress = useMemo(() => {
    if (completed) return null;
    const dailyKey = `daily-${today}-medium`;
    const game = loadGame(dailyKey);
    if (!game) return null;
    const givenCells = countFilledCells(game.puzzle);
    const filledCells = countFilledCells(game.values);
    const remaining = 81 - givenCells;
    if (remaining === 0) return null;
    const pct = Math.round(((filledCells - givenCells) / remaining) * 100);
    return pct > 0 ? pct : null;
  }, [today, completed]);

  const handleDelete = useCallback((key: string) => {
    deleteGame(key);
    setSavedGames((prev) => prev.filter((g) => g.key !== key));
  }, []);
  const isReturningUser = useMemo(
    () => savedGames.length > 0 || getStats().length > 0,
    [savedGames],
  );

  return (
    <div className="screen-content gap-4 sm:gap-8">
      <div className="flex flex-col items-center gap-1 sm:gap-2">
        <h1 className="heading-xl">Dokuel</h1>
        {!isReturningUser && (
          <p className="text-sm text-text-muted">
            Race your friends to solve sudoku.
          </p>
        )}
      </div>
      {!isReturningUser && <DemoBoard />}
      <div className="flex flex-col gap-3 sm:gap-6 w-full">
        {savedGames.length > 0 && (
          <div className="flex flex-col gap-3">
            <span className="label">Continue</span>
            {savedGames.map((game) => (
              <ContinueButton
                key={game.key}
                game={game}
                onClick={() => onContinue(game.key, game.difficulty)}
                onDelete={() => handleDelete(game.key)}
              />
            ))}
          </div>
        )}
        <div className="flex flex-col gap-3">
          <span className="label">Solo</span>
          {isReturningUser && onQuickPlay ? (
            <>
              <ActionButton
                label={`Play ${DIFFICULTY_LABELS[lastDifficulty ?? "medium"] ?? "Medium"}`}
                onClick={onQuickPlay}
                primary
              />
              <button
                type="button"
                className="text-sm text-text-muted hover:text-accent transition-colors"
                onClick={onSolo}
              >
                Choose difficulty
              </button>
            </>
          ) : (
            <ActionButton label="Start Solo" onClick={onSolo} primary />
          )}
          <DailyChallengeButton
            onClick={onDaily}
            completed={completed}
            streak={streak.currentStreak}
            dateLabel={formatShortDate(today)}
            progress={dailyProgress}
          />
          {friendDailyResults && friendDailyResults.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center">
              {friendDailyResults.map((r) => (
                <span key={r.playerId} className="text-xs text-text-muted">
                  {r.playerName} {formatTime(r.time)}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <span className="label">Multiplayer</span>
          <ActionButton label="Create Game" onClick={onCreate} />
          <ActionButton label="Join Game" onClick={onJoin} />
        </div>
        {playerId &&
          friends &&
          onlineFriendIds &&
          pendingInvites &&
          onAddFriend &&
          onRemoveFriend &&
          onInviteFriend &&
          onJoinInvite && (
            <FriendsList
              playerId={playerId}
              friends={friends}
              onlineFriendIds={onlineFriendIds}
              pendingInvites={pendingInvites}
              onAddFriend={onAddFriend}
              onRemoveFriend={onRemoveFriend}
              onInviteFriend={onInviteFriend}
              onJoinInvite={onJoinInvite}
            />
          )}
      </div>
      <div className="flex flex-col gap-2 text-center max-w-sm">
        <p className="text-sm text-text-secondary">
          Four difficulty levels, daily challenges, pencil notes, hints, and
          personal best tracking — all in your browser, no account needed.
        </p>
        <p className="text-sm text-text-secondary">
          Race friends in real-time 1v1 via peer-to-peer — your game data never
          touches a server.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn btn-ghost text-sm"
          onClick={onStats}
        >
          <span className="flex items-center gap-1.5">
            <StatsIcon />
            Stats
          </span>
        </button>
        <span className="text-text-muted text-xs">·</span>
        <button
          type="button"
          className="text-xs text-text-muted hover:text-accent transition-colors"
          onClick={onAbout}
        >
          About
        </button>
        <span className="text-text-muted text-xs">·</span>
        <a
          href="https://github.com/adrienbrault/sudoku"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-accent transition-colors"
        >
          <GitHubIcon />
          <span>Open source</span>
        </a>
      </div>
    </div>
  );
}

function DailyChallengeButton({
  onClick,
  completed,
  streak,
  dateLabel,
  progress,
}: {
  onClick: () => void;
  completed: boolean;
  streak: number;
  dateLabel: string;
  progress: number | null;
}) {
  return (
    <button
      type="button"
      className="btn btn-lg btn-secondary w-full relative"
      onClick={onClick}
    >
      <span className="flex items-center justify-center gap-2">
        Daily Challenge
        <span className="text-sm font-normal text-text-muted">
          — {dateLabel}
        </span>
        {completed && (
          <svg
            className="w-5 h-5 text-emerald-500"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-label="Completed"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
              clipRule="evenodd"
            />
          </svg>
        )}
        {!completed && progress !== null && (
          <span className="text-sm font-normal text-text-muted">
            · {progress}%
          </span>
        )}
      </span>
      {streak > 0 && (
        <span className="text-xs font-medium text-accent mt-0.5 block">
          {streak}-day streak
        </span>
      )}
    </button>
  );
}

function progressPercent(game: SavedGameSummary): number {
  const remaining = 81 - game.givenCells;
  if (remaining === 0) return 100;
  const filled = game.filledCells - game.givenCells;
  return Math.round((filled / remaining) * 100);
}

function ContinueButton({
  game,
  onClick,
  onDelete,
}: {
  game: SavedGameSummary;
  onClick: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex gap-2 w-full">
      <button
        type="button"
        className="btn btn-lg btn-primary flex-1 min-w-0"
        onClick={onClick}
      >
        <span className="flex items-center justify-center gap-2">
          Continue
          <span className="text-sm font-normal opacity-80">
            {DIFFICULTY_LABELS[game.difficulty] ?? game.difficulty} ·{" "}
            {progressPercent(game)}% · {formatTime(game.timer)}
          </span>
        </span>
      </button>
      <button
        type="button"
        className="btn btn-lg btn-secondary px-3 shrink-0"
        onClick={onDelete}
        aria-label="Delete saved game"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 6L6 18" />
          <path d="M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
