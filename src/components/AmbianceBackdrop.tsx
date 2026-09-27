import { useEffect, useRef, useState } from "react";
import { useAmbianceEnabled } from "../hooks/useAmbianceEnabled.ts";
import { ambiance } from "../lib/ambiance.ts";
import { pickQuality } from "../lib/ambiance-quality.ts";

function supportsWebGL2(): boolean {
  return typeof window.WebGL2RenderingContext !== "undefined";
}

/**
 * The 3D world behind every screen. Mounted once at the app root so it
 * persists across navigation: the camera glides between screens instead
 * of each page painting its own backdrop.
 *
 * three.js loads lazily, after first paint. Until the first frame is on
 * screen — and forever, without WebGL2 or with the setting off — the
 * CSS backdrop stands in, so nothing ever waits on the GPU.
 */
export function AmbianceBackdrop() {
  const enabled = useAmbianceEnabled();
  const [failed, setFailed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const active = enabled && !failed && supportsWebGL2();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!active || !canvas) return;
    const root = document.documentElement;
    const isDark = () => root.classList.contains("dark");
    let cancelled = false;
    let teardown = () => {};

    import("../scene/engine.ts")
      .then(({ createAmbianceEngine }) =>
        createAmbianceEngine(canvas, {
          quality: pickQuality({
            devicePixelRatio: window.devicePixelRatio,
            hardwareConcurrency: navigator.hardwareConcurrency ?? 0,
            coarsePointer: window.matchMedia("(pointer: coarse)").matches,
          }),
          dark: isDark(),
          reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches,
          settled: navigator.webdriver === true,
          getState: ambiance.getState,
          onContextLost: () => setFailed(true),
        }),
      )
      .then((engine) => {
        if (cancelled) {
          engine.dispose();
          return;
        }
        const unsubscribe = ambiance.subscribe(engine.handle);
        // The theme is a class on <html>, flipped from more than one
        // place; watching it beats threading isDark through the tree.
        const observer = new MutationObserver(() => engine.setDark(isDark()));
        observer.observe(root, {
          attributes: true,
          attributeFilter: ["class"],
        });
        root.dataset.ambiance = "on";
        teardown = () => {
          unsubscribe();
          observer.disconnect();
          engine.dispose();
        };
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      teardown();
      delete root.dataset.ambiance;
    };
  }, [active]);

  if (!active) return null;
  return (
    <div aria-hidden="true">
      <canvas ref={canvasRef} className="ambiance-canvas" />
    </div>
  );
}
