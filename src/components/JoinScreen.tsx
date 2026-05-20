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
    if (code.trim()) onJoin(code.trim());
  };

  return (
    <div className="screen">
      <form className="screen-content gap-6 py-8" onSubmit={handleSubmit}>
        <div className="flex flex-col items-center gap-3">
          <span className="icon-tile w-14 h-14 bg-accent-soft text-accent">
            <LogIn size={26} strokeWidth={2} aria-hidden="true" />
          </span>
          <h2 className="heading">Join Game</h2>
          <p className="caption text-center">
            Ask the host for their room code
          </p>
        </div>
        <input
          ref={inputRef}
          type="text"
          placeholder="e.g. loud-duck-38"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full px-4 py-3.5 rounded-2xl bg-bg-inset border border-border-default text-text-primary text-center text-lg font-mono tracking-wide outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/25 placeholder:text-text-disabled placeholder:tracking-normal"
        />
        <button
          type="submit"
          disabled={!code.trim()}
          className={`btn btn-lg w-full ${
            code.trim()
              ? "btn-primary"
              : "bg-bg-disabled text-text-disabled cursor-not-allowed"
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
      </form>
    </div>
  );
}
