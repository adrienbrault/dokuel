import { useEffect, useRef } from "react";

/** Save the latest state on internal navigation, page exit, or tab hide. */
export function useFlushOnExit(flush: () => void) {
  const latest = useRef(flush);
  latest.current = flush;
  useEffect(() => {
    const persist = () => latest.current();
    const onVisibility = () => {
      if (document.hidden) persist();
    };
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      persist();
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
}
