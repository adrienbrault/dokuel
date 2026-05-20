import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  Flame,
  LogIn,
  Play,
  Smartphone,
  Swords,
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
import { Logo } from "./Logo.tsx";

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
    <div className="screen-content gap-6 py-8">
      <div className="flex flex-col items-center gap-3">
        <Logo size={56} className="drop-shadow-[0_8px_16px_rgba(0,0,0,0.12)]" />
        <h1 className="heading-xl">Dokuel</h1>
        {!isReturningUser && (
          <p className="caption text-center text-balance">
            Real-time 1v1 sudoku duel — no account needed.
          </p>
        )}
      </div>

      {!isReturningUser && (
        <div className="flex flex-col gap-2.5 w-full">
          <FeatureRow
            icon={<Zap size={17} strokeWidth={2.4} />}
            text="Race a friend in real time, peer-to-peer"
          />
          <FeatureRow
            icon={<CalendarDays size={17} strokeWidth={2.4} />}
            text="A fresh daily challenge for everyone"
          />
          <FeatureRow
            icon={<Smartphone size={17} strokeWidth={2.4} />}
            text="Mobile & desktop — dark mode, haptics, sound"
          />
        </div>
      )}

      <div className="flex flex-col gap-6 w-full">
        {savedGames.length > 0 && (
          <div className="flex flex-col gap-2.5">
            <span className="label">Pick up where you left off</span>
            {savedGames.map((game) => (
              <ContinueCard
                key={game.key}
                game={game}
                onClick={() => onContinue(game.key, game.difficulty)}
                onDelete={() => handleDelete(game.key)}
              />
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            className="btn btn-primary w-full flex items-center justify-center gap-2.5 py-5 text-xl"
            onClick={onSolo}
          >
            <Play size={22} fill="currentColor" strokeWidth={0} />
            Start Solo
          </button>
          <DailyChallengeCard
            onClick={onDaily}
            completed={completed}
            streak={streak.currentStreak}
            dateLabel={formatShortDate(today)}
            progress={dailyProgress}
          />
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="label">Play a friend</span>
          <div className="grid grid-cols-2 gap-2.5">
            <ActionTile
              icon={<Swords size={22} strokeWidth={2} />}
              label="Create Game"
              sublabel="Start a room"
              onClick={onCreate}
            />
            <ActionTile
              icon={<LogIn size={22} strokeWidth={2} />}
              label="Join Game"
              sublabel="Enter a code"
              onClick={onJoin}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          className="btn btn-ghost flex items-center gap-1.5"
          onClick={onStats}
        >
          <BarChart3 size={16} strokeWidth={2.2} aria-hidden="true" />
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

function FeatureRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="icon-tile w-8 h-8 bg-accent-soft text-accent">
        {icon}
      </span>
      <span className="text-sm text-text-secondary">{text}</span>
    </div>
  );
}

function DailyChallengeCard({
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
  const status = completed
    ? "Completed today"
    : progress !== null
      ? `${progress}% done`
      : "New puzzle ready";

  return (
    <button
      type="button"
      className="card w-full flex items-center gap-3.5 p-3.5 text-left press-spring-soft touch-manipulation"
      onClick={onClick}
    >
      <span className="icon-tile w-12 h-12 bg-accent-soft text-accent relative">
        <CalendarDays size={22} strokeWidth={2} aria-hidden="true" />
        {completed && (
          <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-success flex items-center justify-center ring-2 ring-bg-inset">
            <Check size={12} strokeWidth={3} className="text-white" />
          </span>
        )}
      </span>
      <span className="flex-1 min-w-0">
        <span className="font-semibold text-text-primary block">
          Daily Challenge
        </span>
        <span className="text-xs text-text-muted">
          {dateLabel} · {status}
        </span>
      </span>
      {streak > 0 && (
        <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 shrink-0">
          <Flame size={13} strokeWidth={2.4} aria-hidden="true" />
          <span className="text-xs font-bold tabular-nums">{streak}</span>
        </span>
      )}
      <ChevronRight
        size={18}
        className="text-text-muted shrink-0"
        aria-hidden="true"
      />
    </button>
  );
}

function progressPercent(game: SavedGameSummary): number {
  const remaining = 81 - game.givenCells;
  if (remaining === 0) return 100;
  const filled = game.filledCells - game.givenCells;
  return Math.round((filled / remaining) * 100);
}

function ContinueCard({
  game,
  onClick,
  onDelete,
}: {
  game: SavedGameSummary;
  onClick: () => void;
  onDelete: () => void;
}) {
  const percent = progressPercent(game);
  return (
    <div className="card w-full flex items-stretch overflow-hidden">
      <button
        type="button"
        className="flex-1 min-w-0 flex items-center gap-3.5 p-3.5 text-left press-spring-soft touch-manipulation"
        onClick={onClick}
      >
        <span className="icon-tile w-12 h-12 bg-accent text-text-on-accent shrink-0">
          <Play size={20} fill="currentColor" strokeWidth={0} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="font-semibold text-text-primary block">
            Continue · {DIFFICULTY_LABELS[game.difficulty]}
          </span>
          <span className="text-xs text-text-muted tabular-nums">
            {percent}% complete · {formatTime(game.timer)}
          </span>
          <span className="mt-1.5 block h-1.5 rounded-full bg-bg-raised overflow-hidden">
            <span
              className="block h-full rounded-full bg-accent"
              style={{ width: `${percent}%` }}
            />
          </span>
        </span>
      </button>
      <button
        type="button"
        className="flex items-center justify-center w-12 shrink-0 border-l border-border-default text-text-muted hover:text-cell-conflict hover:bg-bg-raised transition-colors touch-manipulation"
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

function ActionTile({
  icon,
  label,
  sublabel,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="btn btn-secondary flex flex-col items-center gap-2 py-4 px-2"
      onClick={onClick}
    >
      <span className="icon-tile w-11 h-11 bg-accent-soft text-accent">
        {icon}
      </span>
      <span className="flex flex-col items-center gap-0.5">
        <span className="text-sm font-semibold text-text-primary">{label}</span>
        <span className="text-[0.6875rem] font-normal text-text-muted">
          {sublabel}
        </span>
      </span>
    </button>
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
