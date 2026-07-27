import {
  CalendarHeart,
  ChartColumn,
  Check,
  ChevronRight,
  Flame,
  LogIn,
  Play,
  Swords,
  Trash2,
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
  const solved = useMemo(() => getStats().filter((s) => s.won).length, []);
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
  const isReturningUser = savedGames.length > 0 || solved > 0;

  const dailySub = completed
    ? `${formatShortDate(today)} · completed`
    : dailyProgress !== null
      ? `${formatShortDate(today)} · ${dailyProgress}% done`
      : `${formatShortDate(today)} · same puzzle for everyone`;

  return (
    <div className="screen-content gap-6 py-10 sm:gap-7">
      <header className="flex flex-col items-center gap-3">
        <Logo size={52} />
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-[2.75rem] leading-none font-extrabold tracking-tight text-text-primary">
            Dokuel
          </h1>
          <p className="text-sm text-text-muted">
            1v1 sudoku duel — no account needed.
          </p>
        </div>
      </header>

      {/* A first-time visitor gets told what the app is; a returning one
          already knows, and gets their own numbers instead. */}
      {isReturningUser ? (
        <div className="card w-full grid grid-cols-3 divide-x divide-border-default">
          <Metric value={solved} label={solved === 1 ? "Puzzle" : "Puzzles"} />
          <Metric value={streak.currentStreak} label="Day streak" />
          <Metric value={streak.longestStreak} label="Best streak" />
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5 w-full">
          <Feature text="Race a friend in real time, peer-to-peer" />
          <Feature text="A fresh daily challenge for everyone" />
          <Feature text="Dark mode, haptics and sound — on any device" />
        </ul>
      )}

      <div className="flex flex-col gap-2.5 w-full">
        {savedGames.map((game) => (
          <ContinueRow
            key={game.key}
            game={game}
            onClick={() => onContinue(game.key, game.difficulty)}
            onDelete={() => handleDelete(game.key)}
          />
        ))}

        <ActionRow
          variant="primary"
          icon={<Play size={20} aria-hidden="true" />}
          label="Start Solo"
          sublabel="Pick a difficulty and play"
          onClick={onSolo}
        />
        <ActionRow
          icon={<CalendarHeart size={20} aria-hidden="true" />}
          label="Daily Challenge"
          sublabel={dailySub}
          onClick={onDaily}
          accessory={
            completed ? (
              <span
                className="icon-chip w-7 h-7 bg-success/15 text-success"
                aria-hidden="true"
              >
                <Check size={16} strokeWidth={3} />
              </span>
            ) : streak.currentStreak > 0 ? (
              <span className="chip bg-accent-light text-accent">
                <Flame size={12} aria-hidden="true" />
                {streak.currentStreak}
              </span>
            ) : undefined
          }
        />
        <ActionRow
          icon={<Swords size={20} aria-hidden="true" />}
          label="Create Game"
          sublabel="Host a 1v1 room"
          onClick={onCreate}
        />
        <ActionRow
          icon={<LogIn size={20} aria-hidden="true" />}
          label="Join Game"
          sublabel="Enter a friend's room code"
          onClick={onJoin}
        />
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          className="flex items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-accent transition-colors touch-manipulation"
          onClick={onStats}
        >
          <ChartColumn size={16} aria-hidden="true" />
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

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 py-3">
      <span className="text-2xl font-extrabold tabular-nums text-text-primary leading-none">
        {value}
      </span>
      <span className="text-[0.6875rem] font-medium text-text-muted">
        {label}
      </span>
    </div>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-2.5">
      <span
        className="w-1.5 h-1.5 rounded-full bg-accent shrink-0"
        aria-hidden="true"
      />
      <span className="text-sm text-text-secondary">{text}</span>
    </li>
  );
}

function ActionRow({
  icon,
  label,
  sublabel,
  onClick,
  variant,
  accessory,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  onClick: () => void;
  variant?: "primary" | undefined;
  accessory?: React.ReactNode;
}) {
  const primary = variant === "primary";
  return (
    <button
      type="button"
      className={`btn ${primary ? "btn-primary" : "btn-secondary"} w-full !justify-start gap-3.5 px-3.5 py-3 text-left`}
      onClick={onClick}
    >
      <span
        className={`icon-chip w-11 h-11 ${primary ? "bg-white/20 text-text-on-accent" : "bg-accent-light text-accent"}`}
      >
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[0.95rem] font-bold leading-tight">
          {label}
        </span>
        <span
          className={`block text-xs leading-tight mt-0.5 truncate ${primary ? "text-text-on-accent/75" : "text-text-muted"}`}
        >
          {sublabel}
        </span>
      </span>
      {accessory}
      <ChevronRight
        size={18}
        className={primary ? "text-text-on-accent/55" : "text-text-muted"}
        aria-hidden="true"
      />
    </button>
  );
}

function GitHubIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function progressPercent(game: SavedGameSummary): number {
  const remaining = 81 - game.givenCells;
  if (remaining === 0) return 100;
  const filled = game.filledCells - game.givenCells;
  return Math.round((filled / remaining) * 100);
}

function ContinueRow({
  game,
  onClick,
  onDelete,
}: {
  game: SavedGameSummary;
  onClick: () => void;
  onDelete: () => void;
}) {
  const pct = progressPercent(game);
  return (
    <div className="card relative w-full flex items-stretch overflow-hidden press-spring-soft">
      <button
        type="button"
        className="flex-1 min-w-0 flex items-center gap-3.5 px-3.5 py-3 text-left touch-manipulation"
        onClick={onClick}
      >
        <span
          className="icon-chip w-11 h-11 bg-accent text-text-on-accent"
          aria-hidden="true"
        >
          <Play size={20} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[0.95rem] font-bold leading-tight text-text-primary">
            Continue
          </span>
          <span className="block text-xs leading-tight mt-0.5 text-text-muted truncate">
            {DIFFICULTY_LABELS[game.difficulty]} · {formatTime(game.timer)}
          </span>
        </span>
        <span className="chip bg-accent-light text-accent tabular-nums">
          {pct}%
        </span>
      </button>
      <button
        type="button"
        className="flex items-center justify-center w-12 shrink-0 border-l border-border-default text-text-muted hover:text-cell-conflict hover:bg-surface-hover transition-colors touch-manipulation"
        onClick={onDelete}
        aria-label="Delete saved game"
      >
        <Trash2 size={17} aria-hidden="true" />
      </button>
      <span
        className="absolute bottom-0 left-0 h-1 bg-accent rounded-r-full transition-all"
        style={{ width: `${pct}%` }}
        aria-hidden="true"
      />
    </div>
  );
}
