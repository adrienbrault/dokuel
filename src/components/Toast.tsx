export function Toast({ message }: { message: string }) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-[10px] bg-cell-conflict text-text-on-accent text-sm font-medium shadow-lg animate-modal-content">
      {message}
    </div>
  );
}
