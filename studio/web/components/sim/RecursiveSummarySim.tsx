"use client";

import type p5 from "p5";
import { P5Stage, type SketchFactory } from "./P5Stage";
import {
  INK,
  bezierPt,
  dot,
  easeIn,
  easeInOut,
  easeOut,
  hexToRgb,
  label,
  rng,
  roundedBox,
  seg,
  token,
} from "./kit";

/**
 * Recursive Summarization — each document is compressed to a summary once;
 * specific facts (the bright specks) are lost in the squeeze; summaries combine
 * to answer. The dropped facts visualize the known factoid-recall failure.
 */
const sketch: SketchFactory = (p: p5, ctx) => {
  const A = hexToRgb(ctx.color);
  const T = 9.5;

  interface Doc {
    cx: number;
    cy: number;
    chunks: { x: number; y: number }[];
    facts: { x: number; y: number }[];
    sum: { x: number; y: number };
    start: number;
  }
  let docs: Doc[] = [];
  let L = { x: 0, y: 0 };
  let boxW = 0;
  let boxH = 0;

  const layout = () => {
    const W = p.width;
    const H = p.height;
    const r = rng(31);
    docs = [];
    const n = 3;
    for (let d = 0; d < n; d++) {
      const cx = W * (0.16 + d * 0.2);
      const cy = H * 0.3;
      const chunks: { x: number; y: number }[] = [];
      for (let i = 0; i < 6; i++)
        chunks.push({ x: cx + (r() - 0.5) * W * 0.1, y: cy + (r() - 0.5) * H * 0.22 });
      const facts: { x: number; y: number }[] = [];
      for (let i = 0; i < 2; i++)
        facts.push({ x: cx + (r() - 0.5) * W * 0.08, y: cy + (r() - 0.5) * H * 0.18 });
      docs.push({ cx, cy, chunks, facts, sum: { x: cx, y: H * 0.6 }, start: 1.4 + d * 0.9 });
    }
    L = { x: W * 0.86, y: H * 0.6 };
    boxW = W * 0.12;
    boxH = H * 0.34;
  };

  p.setup = () => {
    p.createCanvas(ctx.width(), ctx.height);
    layout();
    if (ctx.reduced) p.noLoop();
  };
  p.windowResized = () => {
    p.resizeCanvas(ctx.width(), ctx.height);
    layout();
    if (ctx.reduced) p.redraw();
  };

  p.draw = () => {
    const now = ctx.reduced ? T * 0.62 : (p.millis() / 1000) % T;
    p.clear();

    docs.forEach((d, di) => {
      label(p, d.cx, d.cy - p.height * 0.22, `doc ${di + 1}`, INK, 0.3, 9);
      const collapse = easeInOut(seg(now, d.start, 1.0));

      // chunks collapse toward the summary node
      d.chunks.forEach((c) => {
        const x = p.lerp(c.x, d.sum.x, collapse);
        const y = p.lerp(c.y, d.sum.y, collapse);
        dot(p, x, y, p.lerp(3.4, 1.5, collapse), INK, p.lerp(0.18, 0.05, collapse));
      });

      // facts break off and fall away (detail lost)
      d.facts.forEach((f, fi) => {
        const fall = easeIn(seg(now, d.start + 0.2, 1.0));
        const fx = f.x + (fi === 0 ? -1 : 1) * fall * p.width * 0.03;
        const fy = f.y + fall * p.height * 0.4;
        const a = (1 - fall) * 0.9;
        dot(p, fx, fy, 3.2, A, a, a * 12);
      });

      // summary node
      const born = easeOut(seg(now, d.start + 0.6, 0.6));
      if (born > 0) {
        dot(p, d.sum.x, d.sum.y, 4 + born * 2, A, born * 0.9, born * 14);
        roundedBox(p, d.sum.x, d.sum.y, p.width * 0.05, p.height * 0.07, 6, A, born * 0.5, 0, 1.2);
      }
    });

    // "details lost" caption
    const lostA = easeOut(seg(now, 2.2, 0.8)) * (now < 6 ? 1 : 1 - easeOut(seg(now, 6, 1)));
    label(p, p.width * 0.36, p.height * 0.92, "specific facts lost in summarization", A, lostA * 0.55, 9);

    // summaries combine → model
    const combineStart = 4.6;
    if (now > combineStart) {
      docs.forEach((d, i) => {
        const t = easeInOut(seg(now, combineStart + i * 0.12, 0.95));
        if (t > 0 && t < 1) {
          const pt = bezierPt(d.sum.x, d.sum.y, L.x - boxW / 2, L.y, 10, t);
          token(p, pt.x, pt.y, 6, A, 0.82, 11);
        }
      });
    }

    const lit = easeOut(seg(now, 4.9, 1.0));
    roundedBox(p, L.x, L.y, boxW, boxH, 12, INK, 0.18, 0);
    roundedBox(p, L.x, L.y, boxW, boxH, 12, A, lit * 0.7, lit * 0.05, 1.6);
    label(p, L.x, L.y + boxH / 2 + 14, "model", INK, 0.3, 10);
    const ans = easeOut(seg(now, 6.0, 1.0));
    if (ans > 0) {
      const ax = L.x + boxW / 2 + 14 + ans * 6;
      token(p, ax, L.y, 9 * ans, A, ans, 16 * ans);
      label(p, ax, L.y - 16, "answer", A, ans * 0.8, 10);
    }
  };
};

export function RecursiveSummarySim({ color }: { color: string }) {
  return <P5Stage sketch={sketch} color={color} className="w-full" />;
}
