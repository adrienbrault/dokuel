import { type ReactNode, useEffect, useRef, useState } from "react";
import rough from "roughjs";

type SketchRectProps = {
  children: ReactNode;
  className?: string;
  roughness?: number;
  strokeWidth?: number;
};

export function SketchRect({
  children,
  className = "",
  roughness = 1.2,
  strokeWidth = 1.5,
}: SketchRectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const drawnRef = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setSize({ width, height });
        drawnRef.current = false;
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || size.width === 0 || drawnRef.current) return;
    drawnRef.current = true;

    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    const rc = rough.svg(svg);
    const strokeColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-border-default")
      .trim();

    svg.appendChild(
      rc.rectangle(1, 1, size.width - 2, size.height - 2, {
        stroke: strokeColor,
        strokeWidth,
        roughness,
        fill: "none",
      }),
    );
  }, [size, roughness, strokeWidth]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <svg
        ref={svgRef}
        className="absolute inset-0 pointer-events-none"
        width={size.width || "100%"}
        height={size.height || "100%"}
        aria-hidden="true"
      />
      {children}
    </div>
  );
}
