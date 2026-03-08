export function Toast({ message }: { message: string }) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-rose-500 text-white text-sm font-medium shadow-lg animate-modal-content">
      {message}
    </div>
  );
}
