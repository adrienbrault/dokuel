import { useEffect, useRef, useState } from "react";
import rough from "roughjs";

type SketchOverlayProps = {
  className?: string;
};

export function SketchOverlay({ className = "" }: SketchOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const drawnRef = useRef(false);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const parent = svg.parentElement;
    if (!parent) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setSize({ width, height });
        drawnRef.current = false;
      }
    });
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || size.width === 0 || drawnRef.current) return;
    drawnRef.current = true;

    // Clear previous drawings
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    const rc = rough.svg(svg);
    const { width, height } = size;
    const cellW = width / 9;
    const cellH = height / 9;

    const strokeColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-board-border")
      .trim();

    // Draw thin inner grid lines
    for (let i = 1; i < 9; i++) {
      if (i % 3 === 0) continue; // Skip box borders, drawn separately
      const x = i * cellW;
      const y = i * cellH;
      svg.appendChild(
        rc.line(x, 0, x, height, {
          stroke: strokeColor,
          strokeWidth: 0.5,
          roughness: 1.2,
        }),
      );
      svg.appendChild(
        rc.line(0, y, width, y, {
          stroke: strokeColor,
          strokeWidth: 0.5,
          roughness: 1.2,
        }),
      );
    }

    // Draw thick box borders (3x3 separators)
    for (let i = 1; i < 3; i++) {
      const x = i * 3 * cellW;
      const y = i * 3 * cellH;
      svg.appendChild(
        rc.line(x, 0, x, height, {
          stroke: strokeColor,
          strokeWidth: 2,
          roughness: 1.5,
        }),
      );
      svg.appendChild(
        rc.line(0, y, width, y, {
          stroke: strokeColor,
          strokeWidth: 2,
          roughness: 1.5,
        }),
      );
    }

    // Draw outer border
    svg.appendChild(
      rc.rectangle(0, 0, width, height, {
        stroke: strokeColor,
        strokeWidth: 2.5,
        roughness: 1.5,
        fill: "none",
      }),
    );
  }, [size]);

  return (
    <svg
      ref={svgRef}
      className={`absolute inset-0 pointer-events-none z-10 ${className}`}
      width={size.width || "100%"}
      height={size.height || "100%"}
      aria-hidden="true"
    />
  );
}
