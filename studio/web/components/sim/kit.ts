// Shared toolkit for the approach simulations.
// Math + color helpers (framework-agnostic) and a small set of p5 draw
// primitives so each sketch can stay focused on its own choreography.
//
// Visual language across every sim:
//   • white canvas (the card surface shows through)
//   • inactive chunks = soft ink dots
//   • the active path / answer = the approach's accent colour, with a soft glow
//   • tiny mono labels, low contrast — words live in the HTML caption, not the canvas
import type p5 from "p5";

export const TAU = Math.PI * 2;
export const INK = { r: 26, g: 26, b: 26 };

export type RGB = { r: number; g: number; b: number };

// --- math ---------------------------------------------------------------

export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeInOut = (t: number) => {
  t = clamp(t);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const easeIn = (t: number) => {
  t = clamp(t);
  return t * t * t;
};
/** Progress (0..1) of `now` within the segment [start, start+dur]. */
export const seg = (now: number, start: number, dur: number) => clamp((now - start) / dur);
/** A 0→1→0 pulse over the segment (ease in then out). */
export const pulse = (now: number, start: number, dur: number) => {
  const t = seg(now, start, dur);
  return Math.sin(t * Math.PI);
};

/** Deterministic PRNG so dot layouts are stable across reloads. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export const mixRgb = (a: RGB, b: RGB, t: number): RGB => ({
  r: lerp(a.r, b.r, t),
  g: lerp(a.g, b.g, t),
  b: lerp(a.b, b.b, t),
});

/** Quadratic-ish bezier point between p0 and p1 with a control offset. */
export function bezierPt(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  bend: number,
  t: number,
): { x: number; y: number } {
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const cx = mx + (-dy / len) * bend;
  const cy = my + (dx / len) * bend;
  const u = 1 - t;
  return {
    x: u * u * x0 + 2 * u * t * cx + t * t * x1,
    y: u * u * y0 + 2 * u * t * cy + t * t * y1,
  };
}

// --- p5 draw primitives -------------------------------------------------

export function dot(
  p: p5,
  x: number,
  y: number,
  r: number,
  c: RGB,
  a: number,
  glow = 0,
) {
  const ctx = p.drawingContext as CanvasRenderingContext2D;
  ctx.save();
  if (glow > 0) {
    ctx.shadowBlur = glow;
    ctx.shadowColor = `rgba(${c.r|0},${c.g|0},${c.b|0},${a})`;
  }
  p.noStroke();
  p.fill(c.r, c.g, c.b, a * 255);
  p.circle(x, y, r * 2);
  ctx.restore();
}

export function ring(p: p5, x: number, y: number, r: number, c: RGB, a: number, w = 1.5) {
  p.noFill();
  p.stroke(c.r, c.g, c.b, a * 255);
  p.strokeWeight(w);
  p.circle(x, y, r * 2);
}

export function softLine(
  p: p5,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  c: RGB,
  a: number,
  w = 1,
) {
  p.stroke(c.r, c.g, c.b, a * 255);
  p.strokeWeight(w);
  p.line(x1, y1, x2, y2);
}

/** A curved connector that "draws on" as t goes 0→1. */
export function curveConnector(
  p: p5,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  bend: number,
  draw: number,
  c: RGB,
  a: number,
  w = 1.4,
) {
  const steps = 26;
  const last = Math.max(1, Math.floor(steps * clamp(draw)));
  p.noFill();
  p.stroke(c.r, c.g, c.b, a * 255);
  p.strokeWeight(w);
  p.beginShape();
  for (let i = 0; i <= last; i++) {
    const pt = bezierPt(x0, y0, x1, y1, bend, i / steps);
    p.vertex(pt.x, pt.y);
  }
  p.endShape();
}

export function roundedBox(
  p: p5,
  x: number,
  y: number,
  w: number,
  h: number,
  rad: number,
  stroke: RGB,
  strokeA: number,
  fillA = 0,
  sw = 1.5,
) {
  p.push();
  if (fillA > 0) p.fill(stroke.r, stroke.g, stroke.b, fillA * 255);
  else p.noFill();
  p.stroke(stroke.r, stroke.g, stroke.b, strokeA * 255);
  p.strokeWeight(sw);
  p.rect(x - w / 2, y - h / 2, w, h, rad);
  p.pop();
}

export function label(
  p: p5,
  x: number,
  y: number,
  text: string,
  c: RGB,
  a: number,
  size = 10,
  align: "center" | "left" | "right" = "center",
) {
  p.push();
  p.noStroke();
  p.fill(c.r, c.g, c.b, a * 255);
  p.textFont("monospace");
  p.textSize(size);
  p.textAlign(
    align === "center" ? p.CENTER : align === "left" ? p.LEFT : p.RIGHT,
    p.CENTER,
  );
  // letter-spacing fudge: p5 has no native tracking, so render as-is.
  p.text(text.toUpperCase(), x, y);
  p.pop();
}

/** A travelling "token" — a small rounded square with a soft glow. */
export function token(p: p5, x: number, y: number, s: number, c: RGB, a: number, glow = 10) {
  const ctx = p.drawingContext as CanvasRenderingContext2D;
  ctx.save();
  ctx.shadowBlur = glow;
  ctx.shadowColor = `rgba(${c.r|0},${c.g|0},${c.b|0},${a * 0.9})`;
  p.noStroke();
  p.fill(c.r, c.g, c.b, a * 255);
  p.rect(x - s / 2, y - s / 2, s, s, s * 0.32);
  ctx.restore();
}
