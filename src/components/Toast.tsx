type ToastProps = {
  message: string;
  // "danger" for transient errors (the default), "info" for notices
  // such as an available update: polite status, neutral surface.
  tone?: "danger" | "info";
  action?: { label: string; onClick: () => void };
};

export function Toast({ message, tone = "danger", action }: ToastProps) {
  const info = tone === "info";
  return (
    <div
      role={info ? "status" : "alert"}
      className={`fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium shadow-lg animate-modal-content w-max max-w-[calc(100vw-2rem)] ${info ? "bg-surface text-text-primary border border-border-default" : "bg-danger text-white"}`}
      style={{ top: "calc(env(safe-area-inset-top) + 1rem)" }}
    >
      {message}
      {action && (
        <button
          type="button"
          className="font-bold text-accent touch-manipulation"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
