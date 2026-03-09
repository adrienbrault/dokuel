import {
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { NumPadPosition } from "../lib/types.ts";
import { KeyboardShortcuts } from "./KeyboardShortcuts.tsx";

export type SettingItem = {
  key: string;
  icon: ReactNode;
  label: string;
  content: ReactNode;
};

type GameLayoutProps = {
  onBack: () => void;
  timer: ReactNode;
  numPad: ReactNode;
  board: ReactNode;
  controls: ReactNode;
  position: NumPadPosition;
  title?: string | undefined;
  headerExtra?: ReactNode | undefined;
  footer?: ReactNode | undefined;
  boardClassName?: string | undefined;
  headerClassName?: string | undefined;
  onDeselectCell?: (() => void) | undefined;
  settings?: SettingItem[] | undefined;
};

export function GameLayout({
  onBack,
  timer,
  numPad,
  board,
  controls,
  position,
  title,
  headerExtra,
  footer,
  boardClassName = "",
  headerClassName = "max-w-lg lg:max-w-5xl",
  onDeselectCell,
  settings,
}: GameLayoutProps) {
  const handleBackgroundPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!onDeselectCell) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, [role='region']")) return;
    onDeselectCell();
  };

  return (
    <div className="game-layout-scroll">
      <div
        className="game-layout flex flex-col items-center min-h-dvh bg-bg-primary py-4 px-4 animate-screen-enter"
        onPointerDown={handleBackgroundPointerDown}
      >
        {title && (
          <p className="text-sm font-medium text-text-secondary mb-1">
            {title}
          </p>
        )}

        {/* Header */}
        <div
          className={`game-header flex items-center justify-between w-full ${headerClassName} mb-4`}
        >
          <button
            type="button"
            className="btn-ghost touch-manipulation"
            onClick={onBack}
          >
            ← Back
          </button>
          {timer}
          <SettingsBar settings={settings} />
        </div>

        {headerExtra}

        {/* Main game area — mobile: respects position; desktop: always side-by-side */}
        <div
          className={`
            game-area flex gap-3 w-full justify-center flex-1
            lg:flex-row lg:items-start lg:max-w-5xl lg:mx-auto lg:gap-8
            ${position === "left" ? "flex-row items-center max-w-lg mx-auto lg:max-w-5xl" : ""}
            ${position === "right" ? "flex-row-reverse items-center max-w-lg mx-auto lg:max-w-5xl lg:flex-row" : ""}
            ${position === "bottom" ? "flex-col items-center lg:flex-row lg:items-start" : ""}
          `}
        >
          {/* Mobile: show numpad in position (left/right) */}
          <div className="lg:hidden">{position !== "bottom" && numPad}</div>
          <div
            className={`game-board-col flex flex-col items-center gap-3 ${position === "bottom" ? "flex-1 justify-center w-full" : "flex-1 min-w-0"} ${boardClassName}`}
          >
            {board}
            <div className="game-controls-col flex flex-col items-center gap-3 w-full">
              {controls}
              {/* Mobile: show numpad at bottom if position=bottom */}
              <div className="game-numpad-bottom lg:hidden w-full">
                {position === "bottom" && numPad}
              </div>
            </div>
          </div>
          {/* Landscape: controls + numpad alongside board */}
          <div className="game-numpad-landscape hidden">
            {controls}
            {numPad}
          </div>
          {/* Desktop: numpad + keyboard shortcuts on the right */}
          <div className="hidden lg:flex lg:flex-col lg:gap-6 lg:pt-2">
            {numPad}
            <KeyboardShortcuts />
          </div>
        </div>

        {footer}
        <LandscapeHint />
      </div>
    </div>
  );
}

function LandscapeHint() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem("landscape-hint-dismissed") === "1";
    } catch {
      return false;
    }
  });

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      sessionStorage.setItem("landscape-hint-dismissed", "1");
    } catch {
      // ignore
    }
  }, []);

  if (dismissed) return null;

  return (
    <div className="game-landscape-hint hidden fixed bottom-2 left-1/2 -translate-x-1/2 items-center gap-2 bg-bg-overlay/80 backdrop-blur border border-border-default rounded-full px-3 py-1.5 shadow-lg z-50 text-xs text-text-secondary animate-fade-in">
      <span>Scroll down to hide the browser toolbar</span>
      <button
        type="button"
        className="ml-1 text-text-muted hover:text-text-primary transition-colors"
        onClick={dismiss}
        aria-label="Dismiss hint"
      >
        ✕
      </button>
    </div>
  );
}

function SettingsBar({ settings }: { settings?: SettingItem[] | undefined }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openKey) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpenKey(null);
      }
    }
    document.addEventListener("pointerdown", handleClick);
    return () => document.removeEventListener("pointerdown", handleClick);
  }, [openKey]);

  if (!settings || settings.length === 0) return <div className="w-10" />;

  return (
    <div className="relative flex items-center gap-1" ref={ref}>
      {settings.map((setting) => (
        <div key={setting.key} className="relative">
          <button
            type="button"
            className={`h-8 px-2 flex items-center justify-center rounded-lg text-sm transition-colors touch-manipulation ${
              openKey === setting.key
                ? "bg-bg-raised text-text-primary"
                : "text-text-muted hover:bg-bg-raised"
            }`}
            onClick={() =>
              setOpenKey((k) => (k === setting.key ? null : setting.key))
            }
            aria-label={setting.label}
            aria-expanded={openKey === setting.key}
          >
            {setting.icon}
          </button>
          {openKey === setting.key && (
            <div className="absolute right-0 top-full mt-2 bg-bg-overlay border border-border-default rounded-xl shadow-lg p-3 z-50 animate-fade-in min-w-64">
              {setting.content}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
