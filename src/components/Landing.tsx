import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  Flame,
  LogIn,
  Play,
  Smartphone,
  Trash2,
  Users,
  Zap,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { DIFFICULTY_LABELS } from "../lib/constants.ts";
import { getDailyStreak, isDailyCompleted } from "../lib/daily-streak.ts";
import { formatShortDate, formatTime } from "../lib/format.ts";
import {
  deleteGame,
  listSavedGames,
  loadGame,
  type SavedGameSummary,
} from "../lib/game-storage.ts";
import { getStats } from "../lib/stats.ts";

const ACCENT_GRADIENT =
  "linear-gradient(160deg, oklch(0.58 0.13 173), oklch(0.49 0.12 165))";

type LandingProps = {
  onSolo: () => void;
  onDaily: () => void;
  onCreate: () => void;
  onJoin: () => void;
  onContinue: (gameKey: string, difficulty: string) => void;
  onStats: () => void;
};

export function Landing({
  onSolo,
  onDaily,
  onCreate,
  onJoin,
  onContinue,
  onStats,
}: LandingProps) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const completed = useMemo(() => isDailyCompleted(today), [today]);
  const streak = useMemo(() => getDailyStreak(), []);
  const [savedGames, setSavedGames] = useState(() => listSavedGames());
  const dailyProgress = useMemo(() => {
    if (completed) return null;
    const dailyKey = `daily-${today}-medium`;
    const game = loadGame(dailyKey);
    if (!game) return null;
    const givenCells = game.puzzle.split("").filter((c) => c !== ".").length;
    const filledCells = game.values.split("").filter((c) => c !== ".").length;
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
    <div className="screen-content gap-7">
      <header className="flex flex-col items-center gap-3 text-center">
        <div
          className="flex items-center justify-center w-16 h-16 rounded-2xl shadow-lg shadow-accent/30"
          style={{ backgroundImage: ACCENT_GRADIENT }}
          aria-hidden="true"
        >
          <div className="grid grid-cols-3 gap-[3px]">
            {[..."123456789"].map((k) => (
              <span key={k} className="w-1.5 h-1.5 rounded-[2px] bg-white/85" />
            ))}
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <h1 className="heading-xl">Dokuel</h1>
          {!isReturningUser && (
            <p className="text-sm text-text-secondary">
              1v1 sudoku duel — no account needed.
            </p>
          )}
        </div>
      </header>

      {!isReturningUser && (
        <div className="card w-full divide-y divide-border-default">
          <FeatureRow
            icon={<Zap size={18} />}
            title="Real-time 1v1"
            text="Race a friend peer-to-peer"
          />
          <FeatureRow
            icon={<CalendarDays size={18} />}
            title="Daily challenge"
            text="Same puzzle for everyone"
          />
          <FeatureRow
            icon={<Smartphone size={18} />}
            title="Mobile & desktop"
            text="Dark mode, haptics, sounds"
          />
        </div>
      )}

      <div className="flex flex-col gap-3 w-full">
        {savedGames.length > 0 && (
          <div className="flex flex-col gap-2.5">
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

        <button
          type="button"
          className={`btn btn-lg w-full flex items-center justify-center gap-2 ${
            savedGames.length > 0 ? "btn-secondary" : "btn-primary"
          }`}
          onClick={onSolo}
        >
          <Play size={20} fill="currentColor" aria-hidden="true" />
          Start Solo
        </button>

        <DailyChallengeButton
          onClick={onDaily}
          completed={completed}
          streak={streak.currentStreak}
          dateLabel={formatShortDate(today)}
          progress={dailyProgress}
        />

        <div className="grid grid-cols-2 gap-3">
          <TileButton
            icon={<Users size={22} />}
            label="Create Game"
            onClick={onCreate}
          />
          <TileButton
            icon={<LogIn size={22} />}
            label="Join Game"
            onClick={onJoin}
          />
        </div>
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          className="flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-accent transition-colors touch-manipulation"
          onClick={onStats}
        >
          <BarChart3 size={16} aria-hidden="true" />
          View Stats
        </button>
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

function FeatureRow({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="icon-chip w-9 h-9">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-text-primary">
          {title}
        </span>
        <span className="block text-xs text-text-muted">{text}</span>
      </span>
    </div>
  );
}

function TileButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="card flex flex-col items-center justify-center gap-2.5 py-5 press-spring-soft select-none touch-manipulation hover:bg-bg-raised transition-colors"
      onClick={onClick}
    >
      <span className="icon-chip w-11 h-11">{icon}</span>
      <span className="text-sm font-semibold text-text-primary">{label}</span>
    </button>
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
      className="card w-full flex items-center gap-3 px-4 py-3.5 press-spring-soft select-none touch-manipulation hover:bg-bg-raised transition-colors text-left"
      onClick={onClick}
    >
      <span className="icon-chip w-11 h-11">
        <CalendarDays size={22} aria-hidden="true" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-bold text-text-primary">
          Daily Challenge
        </span>
        <span className="block text-xs text-text-muted">
          {dateLabel}
          {!completed && progress !== null && ` · ${progress}% done`}
        </span>
      </span>
      {completed ? (
        <span className="flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 text-xs font-semibold">
          <Check size={13} strokeWidth={3} aria-hidden="true" />
          Done
        </span>
      ) : streak > 0 ? (
        <span className="flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-2.5 py-1 text-xs font-semibold">
          <Flame size={13} aria-hidden="true" />
          {streak}
        </span>
      ) : (
        <ChevronRight
          size={20}
          className="text-text-muted shrink-0"
          aria-hidden="true"
        />
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
        className="btn btn-lg btn-primary flex-1 min-w-0 px-5"
        onClick={onClick}
      >
        <span className="flex items-center justify-center gap-2">
          Continue
          <span className="text-sm font-normal opacity-80">
            {DIFFICULTY_LABELS[game.difficulty]} · {progressPercent(game)}% ·{" "}
            {formatTime(game.timer)}
          </span>
        </span>
      </button>
      <button
        type="button"
        className="card flex items-center justify-center w-14 shrink-0 text-text-muted press-spring-soft hover:text-text-primary hover:bg-bg-raised transition-colors"
        onClick={onDelete}
        aria-label="Delete saved game"
      >
        <Trash2 size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

function GitHubIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}
