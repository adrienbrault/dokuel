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
      <form className="screen-content gap-6" onSubmit={handleSubmit}>
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="icon-chip w-14 h-14">
            <LogIn size={26} aria-hidden="true" />
          </span>
          <h2 className="heading">Join Game</h2>
          <p className="caption">Enter the room code your friend shared.</p>
        </div>
        <input
          ref={inputRef}
          type="text"
          placeholder="loud-duck-38"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="card w-full px-4 py-4 text-text-primary text-center text-xl font-mono tracking-wide outline-none focus:border-accent transition-colors"
        />
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
          className="btn-ghost touch-manipulation"
          onClick={onBack}
        >
          ← Back
        </button>
      </form>
    </div>
  );
}
