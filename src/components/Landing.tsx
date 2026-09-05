import {
  ArrowDown,
  ArrowUpRight,
  ChartColumn,
  Check,
  Code2,
  Flame,
  MoveUpRight,
  Play,
  Swords,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { DIFFICULTY_LABELS } from "../lib/constants.ts";
import { getDailyStreak, isDailyCompleted } from "../lib/daily-streak.ts";
import { todayLocalISO } from "../lib/date.ts";
import { formatTime } from "../lib/format.ts";
import {
  deleteGame,
  listSavedGames,
  loadGame,
  type SavedGameSummary,
} from "../lib/game-storage.ts";
import { Brand } from "./Brand.tsx";

type LandingProps = {
  onSolo: () => void;
  onDaily: () => void;
  onCreate: () => void;
  onJoin: () => void;
  onContinue: (gameKey: string, difficulty: string) => void;
  onStats: () => void;
  settings?: ReactNode;
};

// A decorative, valid Sudoku fragment. The playable daily is generated on entry.
const PREVIEW =
  "530070000600195000098000060800060003400803001700020006060000280000419005000080079";

export function Landing({
  onSolo,
  onDaily,
  onCreate,
  onJoin,
  onContinue,
  onStats,
  settings,
}: LandingProps) {
  const today = useMemo(() => todayLocalISO(), []);
  const completed = useMemo(() => isDailyCompleted(today), [today]);
  const streak = useMemo(() => getDailyStreak(), []);
  const [savedGames, setSavedGames] = useState(() => listSavedGames());
  const dailyProgress = useMemo(() => {
    if (completed) return null;
    const game = loadGame(`daily-${today}-medium`);
    if (!game) return null;
    const given = game.puzzle.split("").filter((c) => c !== ".").length;
    const filled = game.values.split("").filter((c) => c !== ".").length;
    return given < 81
      ? Math.round(((filled - given) / (81 - given)) * 100)
      : null;
  }, [today, completed]);
  const handleDelete = useCallback((key: string) => {
    deleteGame(key);
    setSavedGames((prev) => prev.filter((g) => g.key !== key));
  }, []);
  const date = new Date(`${today}T12:00:00`);

  return (
    <div className="home">
      <header className="site-header">
        <Brand />
        <nav className="header-nav" aria-label="Main navigation">
          <a href="#ways-to-play">
            The games <ArrowDown size={13} aria-hidden="true" />
          </a>
          <button type="button" onClick={onStats}>
            <ChartColumn size={16} aria-hidden="true" /> View Stats
          </button>
        </nav>
        <div className="header-settings">{settings}</div>
      </header>

      <main>
        <section className="home-hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="status-dot" /> A SMALL DAILY ESCAPE
            </div>
            <h1 id="hero-title">
              Clear your mind.
              <br />
              <em>Make your move.</em>
            </h1>
            <p className="hero-description">
              A quiet moment with numbers. Or a little friendly competition.
              Sudoku, however you like to play.
            </p>
            <button type="button" className="home-primary" onClick={onSolo}>
              Start Solo <ArrowUpRight size={20} aria-hidden="true" />
            </button>
            <p className="hero-footnote">
              <span className="tiny-grid" aria-hidden="true" /> No account. No
              distractions. Just play.
            </p>
          </div>

          <div className="daily-feature">
            <div className="daily-heading">
              <span className="eyebrow">THE DAILY EDITION</span>
              <span className="daily-date">
                {date.toLocaleDateString("en", {
                  month: "short",
                  day: "2-digit",
                })}
              </span>
            </div>
            <div className="daily-art" aria-hidden="true">
              <div className="orbit-label">
                NINE NUMBERS. ENDLESS POSSIBILITIES.
              </div>
              <div className="preview-board">
                {PREVIEW.split("").map((digit, index) => (
                  <span
                    key={`cell-${index}`}
                    className={`preview-cell ${index === 40 ? "preview-selected" : ""} ${digit === "6" ? "preview-highlight" : ""}`}
                  >
                    {digit === "0" ? "" : digit}
                  </span>
                ))}
              </div>
              <span className="art-spark">✳</span>
              <span className="pencil-note">
                a fresh perspective,
                <br />
                every day.
              </span>
            </div>
            <div className="daily-bottom">
              <div>
                <h2>One day. One puzzle.</h2>
                <p>
                  {completed
                    ? "Beautifully done. See you tomorrow."
                    : dailyProgress
                      ? `${dailyProgress}% complete. Pick up where you left off.`
                      : "The same puzzle, for all of us."}
                </p>
              </div>
              <span className="daily-badge">
                {completed ? (
                  <Check size={14} />
                ) : (
                  <span className="badge-dot" />
                )}{" "}
                {completed ? "Solved" : "Medium"}
              </span>
            </div>
            <button type="button" className="daily-action" onClick={onDaily}>
              <span>
                {completed ? "Revisit" : dailyProgress ? "Continue" : "Play"}{" "}
                Daily Challenge
              </span>
              <ArrowUpRight size={20} aria-hidden="true" />
            </button>
          </div>
        </section>

        {savedGames.length > 0 && (
          <section className="saved-section" aria-label="Saved games">
            <div className="section-title">
              <span className="eyebrow">RIGHT WHERE YOU LEFT OFF</span>
              <span>Your progress is saved automatically</span>
            </div>
            <div className="saved-grid">
              {savedGames.map((game) => (
                <ContinueRow
                  key={game.key}
                  game={game}
                  onClick={() => onContinue(game.key, game.difficulty)}
                  onDelete={() => handleDelete(game.key)}
                />
              ))}
            </div>
          </section>
        )}

        <section
          id="ways-to-play"
          className="ways-section"
          aria-labelledby="ways-title"
        >
          <div className="section-title">
            <h2 id="ways-title">Your pace. Your kind of play.</h2>
            <span className="eyebrow">A GRID FOR EVERY MOOD</span>
          </div>
          <div className="mode-grid">
            <button
              type="button"
              className="mode-card mode-solo"
              onClick={onSolo}
            >
              <div className="mode-top">
                <span className="eyebrow">01 / SOLO</span>
                <MoveUpRight size={21} aria-hidden="true" />
              </div>
              <div
                className="mode-illustration solo-illustration"
                aria-hidden="true"
              >
                <span>1</span>
                <span>2</span>
                <span>3</span>
              </div>
              <h3>Find your flow.</h3>
              <p>
                Four difficulties. All the time you need.
                <br />A little space to think.
              </p>
              <span className="mode-link">
                Choose your difficulty{" "}
                <ArrowUpRight size={15} aria-hidden="true" />
              </span>
            </button>
            <button
              type="button"
              className="mode-card mode-duel"
              aria-label="Create Game"
              onClick={onCreate}
            >
              <div className="mode-top">
                <span className="eyebrow">02 / DUEL</span>
                <MoveUpRight size={21} aria-hidden="true" />
              </div>
              <div
                className="mode-illustration duel-illustration"
                aria-hidden="true"
              >
                <span>YOU</span>
                <Swords size={24} />
                <span>THEM</span>
              </div>
              <h3>Great minds. Go.</h3>
              <p>
                Same puzzle. Two players.
                <br />
                Challenge a friend to a live Sudoku race.
              </p>
              <span className="mode-link">
                Create Game <ArrowUpRight size={15} aria-hidden="true" />
              </span>
            </button>
            <div className="mode-card mode-join">
              <div className="mode-top">
                <span className="eyebrow">03 / TOGETHER</span>
                <span className="status-dot" />
              </div>
              <div
                className="mode-illustration join-illustration"
                aria-hidden="true"
              >
                <span>↗</span>
                <span>↙</span>
              </div>
              <h3>You're invited.</h3>
              <p>
                A friend sent you a room code?
                <br />
                Your next good game is waiting.
              </p>
              <button type="button" className="join-action" onClick={onJoin}>
                Join Game <ArrowUpRight size={17} aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
        <div className="home-note">
          <span className="note-star" aria-hidden="true">
            ✳
          </span>
          <p>
            A little less scrolling. <em>A little more solving.</em>
          </p>
          {streak.currentStreak > 0 && (
            <span className="streak-note">
              <Flame size={16} aria-hidden="true" /> {streak.currentStreak} day
              streak
            </span>
          )}
        </div>
      </main>
      <footer className="site-footer">
        <Brand />
        <span className="footer-note">Made for the love of the puzzle.</span>
        <a
          href="https://github.com/adrienbrault/dokuel"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Code2 size={15} aria-hidden="true" /> Open source{" "}
          <ArrowUpRight size={13} aria-hidden="true" />
        </a>
      </footer>
    </div>
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
        <span className="rounded-full bg-accent-light px-2 py-1 text-xs font-bold text-accent tabular-nums">
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
