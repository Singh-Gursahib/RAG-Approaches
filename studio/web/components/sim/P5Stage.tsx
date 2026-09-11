"use client";

import { useEffect, useRef } from "react";
import type p5 from "p5";

export interface SketchCtx {
  color: string;
  reduced: boolean;
  /** Live canvas width (call each frame / on resize). */
  width: () => number;
  height: number;
}

export type SketchFactory = (p: p5, ctx: SketchCtx) => void;

/**
 * Mounts a p5 sketch (instance mode) into a responsive, retina-crisp stage.
 *  • p5 is dynamically imported, so it never enters the initial bundle.
 *  • Resizes with its container (ResizeObserver).
 *  • Pauses its draw loop when scrolled off-screen (IntersectionObserver).
 *  • Honors prefers-reduced-motion: the sketch renders a single static frame.
 */
export function P5Stage({
  sketch,
  color,
  height = 380,
  className,
}: {
  sketch: SketchFactory;
  color: string;
  height?: number;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let instance: p5 | null = null;
    let cancelled = false;
    let ro: ResizeObserver | null = null;
    let io: IntersectionObserver | null = null;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    import("p5").then((mod) => {
      const P5 = mod.default;
      if (cancelled || !hostRef.current) return;
      const host = hostRef.current;
      const getWidth = () => host.clientWidth || 600;

      instance = new P5(
        (p: p5) => sketch(p, { color, reduced, width: getWidth, height }),
        host,
      );

      ro = new ResizeObserver(() => {
        // p5 assigns windowResized on the instance; trigger our resize logic.
        (instance as unknown as { windowResized?: () => void })?.windowResized?.();
      });
      ro.observe(host);

      if (!reduced) {
        io = new IntersectionObserver(
          (entries) => {
            entries.forEach((e) => {
              if (!instance) return;
              if (e.isIntersecting) instance.loop();
              else instance.noLoop();
            });
          },
          { threshold: 0.04 },
        );
        io.observe(host);
      }
    });

    return () => {
      cancelled = true;
      ro?.disconnect();
      io?.disconnect();
      instance?.remove();
      instance = null;
    };
  }, [sketch, color, height]);

  return (
    <div
      ref={hostRef}
      className={className}
      style={{ height }}
      role="img"
      aria-hidden
    />
  );
}
