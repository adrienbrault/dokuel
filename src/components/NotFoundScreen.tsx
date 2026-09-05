/**
 * The 404 screen. Junk paths never boot the multiplayer stack, so a
 * mistyped invite lands here - with a way back and a way to enter the
 * room code by hand, which is the recovery an invite link needs.
 */
export function NotFoundScreen({
  path,
  onHome,
  onJoin,
}: {
  path: string;
  onHome: () => void;
  onJoin: () => void;
}) {
  return (
    <div className="screen">
      <div className="screen-content flex flex-col items-center justify-center gap-4 text-center min-h-dvh">
        <h1 className="heading">Page not found</h1>
        <p className="caption max-w-sm">
          Nothing lives at <span className="text-mono break-all">{path}</span>.
          If a friend sent you an invite, double-check the link or enter the
          room code by hand.
        </p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            className="btn btn-lg btn-primary"
            onClick={onHome}
          >
            Go to Dokuel
          </button>
          <button type="button" className="btn-ghost" onClick={onJoin}>
            Enter a room code
          </button>
        </div>
      </div>
    </div>
  );
}
