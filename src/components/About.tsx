import { GitHubIcon } from "./LandingIcons.tsx";

type AboutProps = {
  onBack: () => void;
  onPlay: () => void;
};

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="heading text-left w-full">{children}</h2>;
}

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="text-sm text-text-secondary space-y-1.5 w-full list-disc pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function About({ onBack, onPlay }: AboutProps) {
  return (
    <div className="screen">
      <div className="screen-content gap-6 sm:gap-10 max-w-2xl">
        <button
          type="button"
          className="btn btn-ghost self-start"
          onClick={onBack}
          aria-label="Back"
        >
          <span className="flex items-center gap-1">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
            Back
          </span>
        </button>

        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="heading-xl">Dokuel</h1>
          <p className="text-text-secondary text-base sm:text-lg">
            1v1 sudoku duel — real-time, peer-to-peer, no account needed.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-lg btn-primary w-full"
          onClick={onPlay}
        >
          Play Now — Free
        </button>

        <section className="flex flex-col gap-2 w-full">
          <SectionHeading>Solo Play</SectionHeading>
          <p className="text-sm text-text-secondary">
            Challenge yourself across four difficulty levels — Easy, Medium,
            Hard, and Expert. Every puzzle is solvable with logic alone.
          </p>
          <FeatureList
            items={[
              "Pencil notes with a 3x3 mini-grid per cell",
              "Multi-level undo with move count badge",
              "Hint system — reveal one cell's correct value with technique explanations",
              "Pause with board overlay",
              "Three assist levels: Paper (no highlights), Standard (conflict highlighting + auto-clear notes), Full (conflicts + row/column highlighting)",
              "Auto-save — resume in-progress games across browser sessions",
              "Personal best time tracking with PB indicator on win",
              "Per-difficulty stats: best time, average, games played",
            ]}
          />
        </section>

        <section className="flex flex-col gap-2 w-full">
          <SectionHeading>Daily Challenge</SectionHeading>
          <p className="text-sm text-text-secondary">
            A fresh puzzle every day — the same one for everyone around the
            world. Compare your time with friends without spoilers.
          </p>
          <FeatureList
            items={[
              "Deterministic generation via seeded RNG — same date, same board, any device",
              "Streak tracking with current and longest streak on the landing page",
              "Progress indicator for in-progress daily puzzles",
            ]}
          />
        </section>

        <section className="flex flex-col gap-2 w-full">
          <SectionHeading>1v1 Multiplayer</SectionHeading>
          <p className="text-sm text-text-secondary">
            Race a friend to solve the same puzzle. Peer-to-peer — your game
            data never touches a server.
          </p>
          <FeatureList
            items={[
              "Peer-to-peer via WebRTC — no server needed, game state syncs directly between players",
              "Auto-generated fun player names (adjective + animal) with inline editing",
              "Create a room, share the link, start racing",
              "Live opponent progress bar showing cells remaining and completion %",
              "60-second disconnect countdown with option to claim win",
              "Rematch without leaving the room",
            ]}
          />
        </section>

        <section className="flex flex-col gap-2 w-full">
          <SectionHeading>Friends</SectionHeading>
          <p className="text-sm text-text-secondary">
            Add friends and see who's online — no account needed. Challenge them
            to a duel with one tap.
          </p>
          <FeatureList
            items={[
              "Add friends via shareable friend code",
              "See which friends are online in real time",
              "Send and receive game invites from the landing page",
              "One-tap join for pending invites",
            ]}
          />
        </section>

        <section className="flex flex-col gap-2 w-full">
          <SectionHeading>Mobile-First Design</SectionHeading>
          <p className="text-sm text-text-secondary">
            Built for touch screens first, with thoughtful details that make
            sudoku feel great on any device.
          </p>
          <FeatureList
            items={[
              "Touch-optimized with 44px+ tap targets",
              "Haptic feedback — distinct vibration patterns for placing, erasing, conflicts, and completion",
              "Synthesized sound effects via Web Audio API (toggleable)",
              "Movable numpad — Bottom, Left, or Right — configurable via settings popover",
              "Safe area support for notched devices",
              "Dark mode with system preference detection + manual toggle",
            ]}
          />
        </section>

        <section className="flex flex-col gap-2 w-full">
          <SectionHeading>Desktop & Keyboard</SectionHeading>
          <p className="text-sm text-text-secondary">
            Full keyboard controls for desktop players who prefer speed.
          </p>
          <FeatureList
            items={[
              "Arrow keys to navigate, 1–9 to place, N for notes, Delete to erase, Ctrl+Z to undo",
              "Responsive side-by-side layout with board and numpad on wide screens",
            ]}
          />
        </section>

        <section className="flex flex-col gap-2 w-full">
          <SectionHeading>Privacy & Open Source</SectionHeading>
          <p className="text-sm text-text-secondary">
            No accounts, no tracking, no ads. Your data stays in your browser.
            The entire codebase is open source.
          </p>
          <FeatureList
            items={[
              "All game data stored locally in your browser (localStorage)",
              "Multiplayer game state flows directly between players via WebRTC",
              "Open source on GitHub — MIT license",
            ]}
          />
        </section>

        <button
          type="button"
          className="btn btn-lg btn-primary w-full"
          onClick={onPlay}
        >
          Play Now — Free
        </button>

        <a
          href="https://github.com/adrienbrault/sudoku"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-accent transition-colors mb-4"
        >
          <GitHubIcon />
          <span>Open source on GitHub</span>
        </a>
      </div>
    </div>
  );
}
