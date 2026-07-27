import { ArrowLeft, Keyboard, Settings, X } from "lucide-react";
import {
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { useDarkMode } from "../hooks/useDarkMode.ts";
import { KEYBOARD_SHORTCUTS } from "../hooks/useKeyboard.ts";
import type { NumPadPosition } from "../lib/types.ts";
import { DarkModeToggle } from "./DarkModeToggle.tsx";
import { NumPadPositionToggle } from "./NumPadPositionToggle.tsx";

type GameLayoutProps = {
  onBack: () => void;
  timer: ReactNode;
  numPad: ReactNode;
  board: ReactNode;
  controls: ReactNode;
  position: NumPadPosition;
  onPositionChange: (position: NumPadPosition) => void;
  title?: string | undefined;
  headerExtra?: ReactNode | undefined;
  footer?: ReactNode | undefined;
  boardClassName?: string | undefined;
  onDeselectCell?: (() => void) | undefined;
  settingsExtra?: ReactNode | undefined;
};

export function GameLayout({
  onBack,
  timer,
  numPad,
  board,
  controls,
  position,
  onPositionChange,
  title,
  headerExtra,
  footer,
  boardClassName = "",
  onDeselectCell,
  settingsExtra,
}: GameLayoutProps) {
  const handleBackgroundPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!onDeselectCell) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, [role='region']")) return;
    onDeselectCell();
  };

  return (
    <div
      className="flex flex-col items-center min-h-dvh bg-bg-primary px-3 pt-3 pb-4 sm:px-4 animate-screen-enter"
      onPointerDown={handleBackgroundPointerDown}
    >
      {/* Top bar. Spans the same width as the play area below so it reads
          as the header of that block rather than floating over the page. */}
      <header className="flex items-center gap-3 w-full max-w-game shrink-0">
        <button
          type="button"
          className="icon-btn w-10 h-10 shrink-0 touch-manipulation"
          onClick={onBack}
          aria-label="Back"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <div className="flex-1 min-w-0 flex flex-col items-center">
          {title && (
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-text-muted truncate max-w-full">
              {title}
            </p>
          )}
          {timer}
        </div>
        <SettingsButton
          position={position}
          onPositionChange={onPositionChange}
          extra={settingsExtra}
        />
      </header>

      {headerExtra}

      <div
        className={`game-grid max-w-game flex-1 mt-3 ${boardClassName}`}
        data-pad={position}
      >
        {/* The board is square, so its width is also its height budget.
            Capping against the viewport height keeps a wide desktop column
            from growing a board that pushes the number pad off-screen. */}
        <div className="game-area-board flex justify-center">
          <div className="w-full max-w-[min(100%,calc(100dvh-13rem))]">
            {board}
          </div>
        </div>

        <div className="game-rail">{controls}</div>

        <div className="game-area-pad flex justify-center">{numPad}</div>
      </div>

      {footer}
    </div>
  );
}

function SettingsButton({
  position,
  onPositionChange,
  extra,
}: {
  position: NumPadPosition;
  onPositionChange: (position: NumPadPosition) => void;
  extra?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const darkMode = useDarkMode();

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handleClick);
    return () => document.removeEventListener("pointerdown", handleClick);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        className="icon-btn w-10 h-10 touch-manipulation"
        onClick={() => setOpen((v) => !v)}
        aria-label="Settings"
        aria-expanded={open}
      >
        <Settings size={18} aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 card p-4 z-50 animate-fade-in w-[19rem] max-w-[calc(100vw-1.5rem)]">
          <div className="flex items-center justify-between mb-3">
            <p className="label">Settings</p>
            <button
              type="button"
              className="w-6 h-6 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary transition-colors"
              onClick={() => setOpen(false)}
              aria-label="Close settings"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>

          <SettingsRow label="Number pad">
            <NumPadPositionToggle
              position={position}
              onChange={onPositionChange}
            />
          </SettingsRow>

          <SettingsRow label="Dark mode">
            <DarkModeToggle
              isDark={darkMode.isDark}
              onToggle={darkMode.toggle}
            />
          </SettingsRow>

          {extra && (
            <div className="pt-3 border-t border-border-default">{extra}</div>
          )}

          {/* Gestures. The number pad carries three distinct actions and
              nothing on the pad itself can explain them without shouting;
              this is where a player goes looking. */}
          <div className="mt-3 pt-3 border-t border-border-default">
            <p className="label mb-2">Number pad gestures</p>
            <dl className="grid grid-cols-[3.25rem_1fr] gap-x-3 gap-y-1.5 text-xs">
              <Gesture verb="Tap" meaning="enter the digit" />
              <Gesture verb="Hold" meaning="add a pencil note" />
              <Gesture verb="Drag" meaning="drop onto any cell" />
              <Gesture verb="Slide" meaning="skim across digits" />
            </dl>
          </div>

          <div className="hidden lg:block mt-3 pt-3 border-t border-border-default">
            <p className="label mb-2 flex items-center gap-1.5">
              <Keyboard size={13} aria-hidden="true" />
              Keyboard
            </p>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              {KEYBOARD_SHORTCUTS.map((s) => (
                <Shortcut key={s.label} keys={s.keys} label={s.label} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-t border-border-default first-of-type:border-t-0">
      <p className="text-sm font-medium text-text-secondary">{label}</p>
      {children}
    </div>
  );
}

function Gesture({ verb, meaning }: { verb: string; meaning: string }) {
  return (
    <>
      <dt className="font-semibold text-text-primary">{verb}</dt>
      <dd className="text-text-muted">{meaning}</dd>
    </>
  );
}

function Shortcut({ keys, label }: { keys: string; label: string }) {
  return (
    <>
      <kbd className="font-mono text-text-primary bg-bg-raised border border-border-default px-1.5 rounded text-center">
        {keys}
      </kbd>
      <span className="text-text-muted">{label}</span>
    </>
  );
}
