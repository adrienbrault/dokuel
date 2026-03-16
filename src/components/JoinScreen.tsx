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
      <form className="screen-content gap-6" onSubmit={handleSubmit}>
        <h2 className="heading">Join Game</h2>
        <div className="flex flex-col items-center gap-2 w-full">
          <input
            ref={inputRef}
            type="text"
            placeholder="e.g. loud-duck-38"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="card w-full px-4 py-3 text-text-primary text-center text-lg font-mono"
          />
          <p className="text-xs text-text-muted">
            Ask the host for their room code
          </p>
        </div>
        <button
          type="submit"
          disabled={!code.trim()}
          className={`btn btn-lg w-full transition-colors ${
            code.trim()
              ? "btn-primary"
              : "bg-bg-disabled text-text-disabled border border-border-default cursor-not-allowed"
          }`}
        >
          Join
        </button>
        <button
          type="button"
          className="btn-ghost mt-2 touch-manipulation"
          onClick={onBack}
        >
          ← Back
        </button>
      </form>
    </div>
  );
}
