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
    if (code.trim()) onJoin(code.trim());
  };

  return (
    <div className="screen">
      <form className="screen-content gap-7 py-10" onSubmit={handleSubmit}>
        <div className="flex flex-col items-center gap-3">
          <span className="icon-chip w-14 h-14">
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
          </span>
          <h2 className="heading">Join Game</h2>
          <p className="caption text-center">
            Enter a friend's room code to join their duel.
          </p>
        </div>

        <input
          ref={inputRef}
          type="text"
          placeholder="e.g. loud-duck-38"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="card w-full px-4 py-3.5 text-text-primary text-center text-lg font-mono placeholder:text-text-muted/60 outline-none focus:border-accent focus:ring-4 focus:ring-accent/15 transition-shadow"
        />

        <div className="flex flex-col gap-3 w-full">
          <button
            type="submit"
            disabled={!code.trim()}
            className={`btn btn-lg w-full ${
              code.trim() ? "btn-primary" : "bg-bg-disabled text-text-disabled"
            }`}
          >
            Join
          </button>
          <button
            type="button"
            className="btn btn-ghost touch-manipulation"
            onClick={onBack}
          >
            ← Back
          </button>
        </div>
      </form>
    </div>
  );
}
