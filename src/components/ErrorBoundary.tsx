import { Component, type ReactNode } from "react";
import { clearAllSavedGames } from "../lib/game-storage.ts";

type ErrorBoundaryProps = {
  children: ReactNode;
  /** Injectable for tests; defaults to a full page reload. */
  reload?: (() => void) | undefined;
};

type ErrorBoundaryState = { hasError: boolean };

/**
 * Last-resort net for render-time throws (corrupt persisted state,
 * junk CRDT values from a peer). React only exposes error boundaries
 * through a class component — the one deliberate exception to the
 * functional-components rule.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    const reload = this.props.reload ?? (() => window.location.reload());
    return (
      <div className="screen">
        <div className="screen-content flex flex-col items-center justify-center gap-4 text-center min-h-dvh">
          <h1 className="heading">Something went wrong</h1>
          <p className="text-text-secondary max-w-sm">
            The game hit an unexpected error. Reloading usually fixes it. If it
            keeps happening, clearing saved games removes the corrupted state —
            your stats and streaks are kept.
          </p>
          <button
            type="button"
            className="btn btn-lg btn-primary"
            onClick={reload}
          >
            Reload
          </button>
          <button
            type="button"
            className="btn btn-md btn-ghost"
            onClick={() => {
              clearAllSavedGames();
              reload();
            }}
          >
            Clear saved games &amp; reload
          </button>
        </div>
      </div>
    );
  }
}
