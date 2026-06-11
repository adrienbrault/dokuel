import { LogIn } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button.tsx";
import { Input } from "./ui/input.tsx";

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
        <Input
          ref={inputRef}
          type="text"
          placeholder="e.g. loud-duck-38"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="h-auto py-3.5 text-center text-lg font-mono"
        />
        <Button
          type="submit"
          size="lg"
          disabled={!code.trim()}
          className="w-full"
        >
          Join
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="touch-manipulation"
          onClick={onBack}
        >
          ← Back
        </Button>
      </form>
    </div>
  );
}
