"use client";

import type p5 from "p5";
import { P5Stage, type SketchFactory } from "./P5Stage";
import {
  INK,
  bezierPt,
  curveConnector,
  dot,
  easeInOut,
  easeOut,
  hexToRgb,
  label,
  ring,
  roundedBox,
  seg,
  token,
} from "./kit";

/**
 * Hybrid RAG — keyword (BM25) and vector (dense) retrieval run in parallel,
 * each producing a ranked list; Reciprocal Rank Fusion blends them into one.
 */
const sketch: SketchFactory = (p: p5, ctx) => {
  const A = hexToRgb(ctx.color);
  const T = 9;

  let bm25: { x: number; y: number }[] = [];
  let dense: { x: number; y: number }[] = [];
  const bmMatch = [1, 3, 4];
  const dnMatch = [2, 3, 5];
  let O = { x: 0, y: 0 };
  let R = { x: 0, y: 0 }; // RRF node
  let fused: { x: number; y: number }[] = [];
  let L = { x: 0, y: 0 };
  let boxW = 0;
  let boxH = 0;

  const layout = () => {
    const W = p.width;
    const H = p.height;
    const n = 7;
    const x0 = W * 0.24;
    const x1 = W * 0.5;
    bm25 = [];
    dense = [];
    for (let i = 0; i < n; i++) {
      const x = p.lerp(x0, x1, i / (n - 1));
      bm25.push({ x, y: H * 0.27 });
      dense.push({ x, y: H * 0.73 });
    }
    O = { x: W * 0.09, y: H * 0.5 };
    R = { x: W * 0.63, y: H * 0.5 };
    L = { x: W * 0.88, y: H * 0.5 };
    boxW = W * 0.13;
    boxH = H * 0.4;
    fused = [];
    for (let i = 0; i < 4; i++) fused.push({ x: W * 0.73, y: H * 0.5 + (i - 1.5) * H * 0.1 });
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
    const now = ctx.reduced ? T * 0.6 : (p.millis() / 1000) % T;
    p.clear();

    // lane labels
    label(p, bm25[0].x - 6, bm25[0].y - 26, "bm25 · keyword", INK, 0.32, 9, "left");
    label(p, dense[0].x - 6, dense[0].y + 26, "dense · vector", INK, 0.32, 9, "left");

    // base lane dots
    [bm25, dense].forEach((lane) => lane.forEach((c) => dot(p, c.x, c.y, 3.2, INK, 0.15)));

    // query split lines (appear during travel)
    const split = easeOut(seg(now, 0.7, 1.0));
    if (split > 0) {
      curveConnector(p, O.x, O.y, bm25[0].x, bm25[0].y, -20, split, INK, 0.18, 1.2);
      curveConnector(p, O.x, O.y, dense[0].x, dense[0].y, 20, split, INK, 0.18, 1.2);
    }

    // ranking: matches light up
    const rankStart = 1.9;
    bmMatch.forEach((idx, i) => {
      const g = easeOut(seg(now, rankStart + i * 0.16, 0.5));
      if (g <= 0) return;
      const c = bm25[idx];
      dot(p, c.x, c.y, 3.2 + g * 3, A, 0.4 + g * 0.5, g * 12);
      // keyword underline tick
      p.stroke(A.r, A.g, A.b, g * 200);
      p.strokeWeight(2);
      p.line(c.x - 6, c.y + 9, c.x + 6, c.y + 9);
    });
    dnMatch.forEach((idx, i) => {
      const g = easeOut(seg(now, rankStart + i * 0.16, 0.5));
      if (g <= 0) return;
      const c = dense[idx];
      dot(p, c.x, c.y, 3.2 + g * 3, A, 0.4 + g * 0.5, g * 12);
      ring(p, c.x, c.y, 9, A, g * 0.55, 1.4); // proximity ring
    });

    // flow to RRF node
    const flow = (lane: typeof bm25, matches: number[], bend: number) =>
      matches.forEach((idx, i) => {
        const t = easeInOut(seg(now, 3.3 + i * 0.1, 0.95));
        if (t > 0 && t < 1) {
          const c = lane[idx];
          const pt = bezierPt(c.x, c.y, R.x, R.y, bend, t);
          token(p, pt.x, pt.y, 6, A, 0.8, 10);
        }
      });
    if (now > 3.3) {
      flow(bm25, bmMatch, -24);
      flow(dense, dnMatch, 24);
    }

    // RRF node
    const rrfLit = easeOut(seg(now, 3.6, 1.0));
    roundedBox(p, R.x, R.y, p.width * 0.075, p.height * 0.16, 9, A, 0.25 + rrfLit * 0.55, rrfLit * 0.06, 1.5);
    label(p, R.x, R.y, "rrf", A, 0.5 + rrfLit * 0.4, 10);

    // fused ranked stack
    const fStart = 4.5;
    fused.forEach((f, i) => {
      const g = easeOut(seg(now, fStart + i * 0.12, 0.5));
      if (g <= 0) return;
      dot(p, f.x, f.y, 3 + g * 3, A, g * 0.85, g * 12);
      // rank bar
      p.noStroke();
      p.fill(A.r, A.g, A.b, g * 120);
      p.rect(f.x + 10, f.y - 2.5, (28 - i * 6) * g, 5, 2);
    });
    if (now > fStart) label(p, fused[0].x, fused[0].y - 24, "fused top-k", INK, 0.3, 9);

    // fused → model
    if (now > 5.6) {
      const t = easeInOut(seg(now, 5.6, 0.9));
      if (t < 1) {
        const pt = bezierPt(fused[1].x + 4, fused[1].y, L.x - boxW / 2, L.y, 0, t);
        token(p, pt.x, pt.y, 7, A, 0.85, 12);
      }
    }

    // model + answer
    const lit = easeOut(seg(now, 5.9, 1.0));
    roundedBox(p, L.x, L.y, boxW, boxH, 12, INK, 0.18, 0);
    roundedBox(p, L.x, L.y, boxW, boxH, 12, A, lit * 0.7, lit * 0.05, 1.6);
    label(p, L.x, L.y + boxH / 2 + 14, "model", INK, 0.3, 10);
    const ans = easeOut(seg(now, 6.8, 1.0));
    if (ans > 0) {
      const ax = L.x + boxW / 2 + 16 + ans * 6;
      token(p, ax, L.y, 9 * ans, A, ans, 16 * ans);
      label(p, ax, L.y - 16, "answer", A, ans * 0.8, 10);
    }

    // query token
    const qFade = now < 0.7 ? easeOut(seg(now, 0, 0.6)) : now > 6 ? 1 - easeOut(seg(now, 6, 1.5)) : 1;
    token(p, O.x, O.y, 9, A, qFade, 14);
    if (now < 1.6) label(p, O.x, O.y - 16, "query", INK, qFade * 0.45, 10);
  };
};

export function HybridSim({ color }: { color: string }) {
  return <P5Stage sketch={sketch} color={color} className="w-full" />;
}
