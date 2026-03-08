import type { AssistLevel, NumPadPosition } from "../lib/types.ts";

const POSITION_ARROWS: Record<NumPadPosition, string> = {
  left: "←",
  bottom: "↓",
  right: "→",
};

export function NumPadPositionIcon({ position }: { position: NumPadPosition }) {
  return (
    <span className="flex items-center gap-0.5 font-medium text-xs">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <line x1="4" y1="10" x2="20" y2="10" />
        <line x1="10" y1="4" x2="10" y2="10" />
      </svg>
      {POSITION_ARROWS[position]}
    </span>
  );
}

const ASSIST_LABELS: Record<AssistLevel, string> = {
  paper: "Paper",
  standard: "Std",
  full: "Full",
};

export function AssistLevelIcon({ level }: { level: AssistLevel }) {
  return (
    <span className="flex items-center gap-0.5 font-medium text-xs">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
      {ASSIST_LABELS[level]}
    </span>
  );
}

export function OpponentBarIcon({ visible }: { visible: boolean }) {
  return (
    <span className="flex items-center gap-0.5 font-medium text-xs">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
      {visible ? "On" : "Off"}
    </span>
  );
}
