export function Toast({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="fixed left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-danger text-white text-sm font-medium shadow-lg animate-modal-content"
      style={{ top: "calc(env(safe-area-inset-top) + 1rem)" }}
    >
      {message}
    </div>
  );
}
