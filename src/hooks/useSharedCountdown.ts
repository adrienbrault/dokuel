import { useEffect, useState } from "react";

export function useSharedCountdown(
  deadline: number | null | undefined,
): number {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!deadline || deadline <= Date.now()) return;
    const timer = setInterval(() => {
      tick((value) => value + 1);
      if (Date.now() >= deadline) clearInterval(timer);
    }, 100);
    return () => clearInterval(timer);
  }, [deadline]);
  return deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : 0;
}
