import { useEffect, useRef, useState } from "react";

/**
 * The four things a racing player has to say. Deliberately not
 * extensible: a fixed set needs no keyboard, no moderation, and no
 * translation, and every one of them reads the same in any language.
 */
export const REACTIONS = ["👋", "🔥", "😅", "🎉"] as const;

type ReactionPickerProps = {
  onSend: (emoji: string) => void;
};

/**
 * Reactions behind one control. Four emoji laid out inline would need
 * ~130px beside Undo and Erase, which the 320px-wide iPhone SE does not
 * have - so the row opens on demand instead of shrinking the buttons
 * below a thumb's worth of target.
 */
export function ReactionPicker({ onSend }: ReactionPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    // Hand focus back to the trigger rather than letting it fall to
    // <body>, the same way the settings popover does.
    function handleKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        className="flex items-center justify-center w-11 h-[38px] rounded-xl border border-border-default bg-surface text-base leading-none select-none touch-manipulation transition-colors hover:bg-surface-hover press-spring-soft"
        onClick={() => setOpen((v) => !v)}
        aria-label="Send a reaction"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span aria-hidden="true">🙂</span>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Reactions"
          className="absolute right-0 top-full mt-2 flex gap-1.5 rounded-2xl border border-border-default bg-surface p-1.5 shadow-xl z-50 animate-fade-in max-w-[calc(100vw-2rem)]"
        >
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="flex items-center justify-center w-11 h-11 rounded-xl text-2xl leading-none select-none touch-manipulation hover:bg-surface-hover press-spring-soft"
              aria-label={`Send ${emoji}`}
              onClick={() => {
                onSend(emoji);
                setOpen(false);
              }}
            >
              <span aria-hidden="true">{emoji}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
