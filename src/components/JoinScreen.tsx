import { LogIn } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function JoinScreen({
  onJoin,
  onBack,
}: {
  onJoin: (roomId: string) => void;
  onBack: () => void;
}) {
  const [code, setCode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Yjs room names are case-sensitive and codes are minted lowercase;
    // anything a keyboard capitalized would join a different, empty
    // room with no error.
    const normalized = code.trim().toLowerCase();
    if (normalized) onJoin(normalized);
  };

  return (
    <div className="screen">
      <form
        className="screen-content gap-6 py-10 short:gap-4 short:py-5"
        onSubmit={handleSubmit}
      >
        <header className="flex flex-col items-center gap-3">
          <span
            className="icon-chip w-14 h-14 bg-accent-light text-accent"
            aria-hidden="true"
          >
            <LogIn size={26} />
          </span>
          <h2 className="heading">Join Game</h2>
          <p className="caption text-center">
            Ask the host for their room code.
          </p>
        </header>
        <input
          ref={inputRef}
          type="text"
          aria-label="Room code"
          placeholder="e.g. loud-duck-7kmq"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="w-full px-4 py-3.5 rounded-2xl bg-surface border-2 border-border-default text-text-primary text-center text-lg font-mono shadow-sm transition-colors focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={!code.trim()}
          className={`btn btn-lg w-full transition-all ${
            code.trim()
              ? "btn-primary"
              : "bg-bg-disabled text-text-disabled cursor-not-allowed"
          }`}
        >
          Join
        </button>
        <button
          type="button"
          className="btn-ghost touch-manipulation"
          onClick={onBack}
        >
          ← Back
        </button>
      </form>
    </div>
  );
}
