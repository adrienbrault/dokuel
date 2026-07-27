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
      <form className="screen-content gap-6 py-10" onSubmit={handleSubmit}>
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
          inputMode="text"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="loud-duck-38"
          aria-label="Room code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="field px-4 py-3.5 text-center text-lg font-mono tracking-wide"
        />
        <button
          type="submit"
          disabled={!code.trim()}
          className="btn btn-lg btn-primary w-full"
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
