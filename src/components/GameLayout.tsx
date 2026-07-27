import { ArrowLeft, Settings, X } from "lucide-react";
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
  headerClassName?: string | undefined;
  onDeselectCell?: (() => void) | undefined;
  settingsExtra?: ReactNode | undefined;
  /**
   * Fill of the masthead rule, 0–100. When set, a thin cobalt line
   * inks along the header's hairline as the puzzle fills in.
   */
  progressPercent?: number | undefined;
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
  headerClassName = "max-w-lg lg:max-w-[35rem]",
  onDeselectCell,
  settingsExtra,
  progressPercent,
}: GameLayoutProps) {
  const handleBackgroundPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!onDeselectCell) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, [role='region']")) return;
    onDeselectCell();
  };

  return (
    <div
      className="flex flex-col items-center min-h-dvh bg-bg-primary py-4 px-4 animate-screen-enter lg:bg-bg-inset lg:[background-image:radial-gradient(120%_70%_at_50%_-20%,var(--color-screen-glow),transparent_60%)]"
      onPointerDown={handleBackgroundPointerDown}
    >
      {title && (
        <p className="font-mono text-xs tracking-[0.08em] uppercase text-text-muted mb-2">
          {title}
        </p>
      )}

      {/* Masthead — back, timer, and settings sit on a single hairline
          rule like a newspaper folio; the rule doubles as a progress
          bar, inking in as the puzzle fills. */}
      <div
        className={`relative flex items-center justify-between w-full ${headerClassName} pb-2.5 border-b border-border-default mb-4`}
      >
        <button
          type="button"
          className="icon-btn w-10 h-10 touch-manipulation"
          onClick={onBack}
          aria-label="Back"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        {timer}
        <SettingsButton
          position={position}
          onPositionChange={onPositionChange}
          extra={settingsExtra}
        />
        {progressPercent !== undefined && (
          <span
            aria-hidden="true"
            className="absolute left-0 -bottom-px h-[2px] rounded-full bg-accent transition-[width] duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        )}
      </div>

      {headerExtra}

      {/* Main game area — the numpad sits in its chosen position at every
          breakpoint: "bottom" stacks a full-width digit row under the board,
          "left"/"right" place a vertical column beside it. Keeping the layout
          identical on mobile and desktop means dragging a digit toward the
          board is always a perpendicular gesture.
          On desktop the whole area becomes a paper sheet resting on the
          tinted desk (the lg: root background above), so the board,
          controls, and numpad stop floating in dead space. */}
      <div
        className={`
          flex gap-3 w-full justify-center flex-1
          lg:w-auto lg:flex-none lg:my-auto lg:gap-6 lg:bg-surface lg:border lg:border-border-default lg:rounded-[20px] lg:p-6
          lg:shadow-[0_2px_6px_oklch(0.25_0.02_264/0.05),0_24px_56px_-24px_oklch(0.25_0.02_264/0.18)]
          dark:lg:shadow-[0_2px_6px_oklch(0_0_0/0.12),0_24px_56px_-24px_oklch(0_0_0/0.45)]
          ${position === "left" ? "flex-row items-end lg:items-center" : ""}
          ${position === "right" ? "flex-row-reverse items-end lg:items-center" : ""}
          ${position === "bottom" ? "flex-col items-center" : ""}
        `}
      >
        {/* Side numpad (left / right positions) */}
        {position !== "bottom" && numPad}
        <div
          className={`flex flex-col items-center gap-3 lg:max-w-lg ${position === "bottom" ? "w-full flex-1 justify-end lg:justify-center lg:w-[32rem]" : "flex-1 min-w-0 lg:flex-none lg:w-[32rem]"} ${boardClassName}`}
        >
          <div className="flex flex-col items-center gap-3 w-full">
            {controls}
          </div>
          <div
            style={{
              width:
                position === "bottom"
                  ? "calc(100% + 1rem)"
                  : "calc(100% + 0.5rem)",
            }}
            className={`flex justify-center lg:!w-full lg:mx-0 ${
              position === "bottom"
                ? "-mx-2"
                : position === "left"
                  ? "-mr-2"
                  : "-ml-2"
            }`}
          >
            {board}
          </div>
          {/* Bottom numpad — widened to span the board on mobile, where the
              board itself runs edge-to-edge; reset to the board width on
              desktop where the board is capped. */}
          {position === "bottom" && (
            <div className="flex justify-center -mx-2 w-[calc(100%+1rem)] lg:mx-0 lg:w-full">
              {numPad}
            </div>
          )}
        </div>
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
    <div className="relative" ref={ref}>
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
        <div className="absolute right-0 top-full mt-2 bg-surface border border-border-default rounded-2xl shadow-xl p-3.5 z-50 animate-fade-in w-72 max-w-[calc(100vw-2rem)]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-text-muted font-medium">
              Numpad position
            </p>
            <button
              type="button"
              className="w-6 h-6 flex items-center justify-center rounded text-text-muted hover:text-text-primary transition-colors"
              onClick={() => setOpen(false)}
              aria-label="Close settings"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
          <NumPadPositionToggle
            position={position}
            onChange={onPositionChange}
          />
          <div className="mt-3 pt-3 border-t border-border-default flex items-center justify-between">
            <p className="text-xs text-text-muted font-medium">Dark mode</p>
            <DarkModeToggle
              isDark={darkMode.isDark}
              onToggle={darkMode.toggle}
            />
          </div>
          {extra && (
            <div className="mt-3 pt-3 border-t border-border-default">
              {extra}
            </div>
          )}
          <div className="hidden lg:block mt-3 pt-3 border-t border-border-default">
            <p className="text-xs text-text-muted mb-2 font-medium">
              Keyboard shortcuts
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

function Shortcut({ keys, label }: { keys: string; label: string }) {
  return (
    <>
      <kbd className="font-mono text-text-primary bg-bg-raised px-1 rounded text-center">
        {keys}
      </kbd>
      <span className="text-text-muted">{label}</span>
    </>
  );
}
