import { ArrowLeft, Settings } from "lucide-react";
import type { PointerEvent, ReactNode } from "react";
import { useDarkMode } from "../hooks/useDarkMode.ts";
import { KEYBOARD_SHORTCUTS } from "../hooks/useKeyboard.ts";
import type { NumPadPosition } from "../lib/types.ts";
import { DarkModeToggle } from "./DarkModeToggle.tsx";
import { NumPadPositionToggle } from "./NumPadPositionToggle.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover.tsx";

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
  headerClassName = "max-w-lg",
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
      className="flex flex-col items-center min-h-dvh bg-bg-primary py-4 px-4 animate-screen-enter"
      onPointerDown={handleBackgroundPointerDown}
    >
      {title && (
        <p className="text-sm font-medium text-text-secondary mb-1">{title}</p>
      )}

      {/* Header */}
      <div
        className={`flex items-center justify-between w-full ${headerClassName} mb-4`}
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
      </div>

      {headerExtra}

      {/* Main game area — the numpad sits in its chosen position at every
          breakpoint: "bottom" stacks a full-width digit row under the board,
          "left"/"right" place a vertical column beside it. Keeping the layout
          identical on mobile and desktop means dragging a digit toward the
          board is always a perpendicular gesture. */}
      <div
        className={`
          flex gap-3 w-full justify-center flex-1
          ${position === "left" ? "flex-row items-end lg:items-center" : ""}
          ${position === "right" ? "flex-row-reverse items-end lg:items-center" : ""}
          ${position === "bottom" ? "flex-col items-center" : ""}
        `}
      >
        {/* Side numpad (left / right positions) */}
        {position !== "bottom" && numPad}
        <div
          className={`flex flex-col items-center gap-3 lg:max-w-lg ${position === "bottom" ? "w-full flex-1 justify-end lg:justify-center" : "flex-1 min-w-0 lg:flex-none lg:w-[32rem]"} ${boardClassName}`}
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
  const darkMode = useDarkMode();

  return (
    <Popover>
      <PopoverTrigger
        type="button"
        className="icon-btn w-10 h-10 touch-manipulation"
        aria-label="Settings"
      >
        <Settings size={18} aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 max-w-[calc(100vw-2rem)] p-3.5"
      >
        <p className="text-xs text-text-muted font-medium mb-2">
          Numpad position
        </p>
        <NumPadPositionToggle position={position} onChange={onPositionChange} />
        <div className="mt-3 pt-3 border-t border-border-default flex items-center justify-between">
          <p className="text-xs text-text-muted font-medium">Dark mode</p>
          <DarkModeToggle isDark={darkMode.isDark} onToggle={darkMode.toggle} />
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
      </PopoverContent>
    </Popover>
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
