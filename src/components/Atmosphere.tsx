import { useEffect, useRef } from "react";
import {
  type AtmosphereDirector,
  type AtmosphereMood,
  createAtmosphereDirector,
  subscribeAtmosphere,
} from "../lib/atmosphere.ts";
import { createEngine, type Engine } from "./atmosphere-scene.ts";

/**
 * React shell around the WebGL world (see atmosphere-scene.ts).
 * Owns the frame loop and every browser signal the scene needs:
 * resize, visibility, pointer parallax, theme and reduced-motion.
 * The DOM UI stays the game — this layer never takes input.
 */
export function Atmosphere({ mood }: { mood: AtmosphereMood }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const directorRef = useRef<AtmosphereDirector | null>(null);
  const moodRef = useRef(mood);
  moodRef.current = mood;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const director = createAtmosphereDirector();
    director.apply({ kind: "mood", mood: moodRef.current });
    directorRef.current = director;

    let engine: Engine;
    try {
      engine = createEngine(container, director);
    } catch {
      // No WebGL on this machine — the CSS ambient glow stands in.
      directorRef.current = null;
      return;
    }

    const unsubBus = subscribeAtmosphere((event) => director.apply(event));

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let last = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      director.tick(dt);
      engine.frame(dt, now / 1000);
      raf = requestAnimationFrame(step);
    };
    const start = () => {
      if (raf === 0 && !reducedMotion.matches && !document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(step);
      }
    };
    const stop = () => {
      if (raf !== 0) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    if (reducedMotion.matches) {
      // One composed still frame: the world exists, it just holds still.
      director.tick(0.016);
      engine.frame(0.016, 0);
    } else {
      start();
    }

    const onResize = () => engine.resize(window.innerWidth, window.innerHeight);
    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    const onPointerMove = (event: PointerEvent) => {
      engine.setPointer(
        (event.clientX / window.innerWidth) * 2 - 1,
        (event.clientY / window.innerHeight) * 2 - 1,
      );
    };
    const onReducedMotionChange = () => {
      if (reducedMotion.matches) {
        stop();
        engine.frame(0.016, performance.now() / 1000);
      } else {
        start();
      }
    };
    const themeObserver = new MutationObserver(() => {
      engine.setTheme(document.documentElement.classList.contains("dark"));
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    engine.setTheme(document.documentElement.classList.contains("dark"));

    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    reducedMotion.addEventListener("change", onReducedMotionChange);

    return () => {
      stop();
      unsubBus();
      themeObserver.disconnect();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointerMove);
      reducedMotion.removeEventListener("change", onReducedMotionChange);
      engine.dispose();
      directorRef.current = null;
    };
  }, []);

  useEffect(() => {
    directorRef.current?.apply({ kind: "mood", mood });
  }, [mood]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="atmosphere-layer"
      data-atmosphere
    />
  );
}
