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
  rng,
  roundedBox,
  seg,
  token,
} from "./kit";

/**
 * Naive RAG — embed the query, pull the k nearest chunks, generate.
 * The query travels into a cloud of chunks; its k nearest light up and flow
 * into the model, which emits an answer.
 */
const sketch: SketchFactory = (p: p5, ctx) => {
  const A = hexToRgb(ctx.color);
  const T = 8.5;
  const K = 4;

  let chunks: { x: number; y: number }[] = [];
  let order: number[] = [];
  let O = { x: 0, y: 0 };
  let Q = { x: 0, y: 0 };
  let L = { x: 0, y: 0 };
  let boxW = 0;
  let boxH = 0;

  const layout = () => {
    const W = p.width;
    const H = p.height;
    const r = rng(7);
    chunks = [];
    for (let i = 0; i < 24; i++) {
      chunks.push({
        x: W * 0.3 + r() * W * 0.34,
        y: H * 0.16 + r() * H * 0.68,
      });
    }
    O = { x: W * 0.11, y: H * 0.5 };
    Q = { x: W * 0.46, y: H * 0.44 };
    L = { x: W * 0.86, y: H * 0.5 };
    boxW = W * 0.14;
    boxH = H * 0.42;
    order = chunks
      .map((c, i) => ({ i, d: Math.hypot(c.x - Q.x, c.y - Q.y) }))
      .sort((a, b) => a.d - b.d)
      .map((o) => o.i);
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
    const now = ctx.reduced ? T * 0.58 : (p.millis() / 1000) % T;
    p.clear();

    const top = order.slice(0, K);
    const topSet = new Set(top);

    // query token position
    const tTravel = easeInOut(seg(now, 0.7, 1.4));
    const qx = now < 0.7 ? O.x : now < 2.1 ? p.lerp(O.x, Q.x, tTravel) : Q.x;
    const qy = now < 0.7 ? O.y : now < 2.1 ? p.lerp(O.y, Q.y, tTravel) : Q.y;

    // corpus label + dots
    label(p, p.width * 0.47, p.height * 0.085, "corpus", INK, 0.32, 10);
    chunks.forEach((c, i) => {
      if (topSet.has(i) && now > 2.1) return; // drawn active below
      dot(p, c.x, c.y, 3.4, INK, 0.16);
    });

    // retrieval lines + active chunks
    if (now > 2.1) {
      top.forEach((idx, i) => {
        const c = chunks[idx];
        const draw = easeOut(seg(now, 2.1 + i * 0.14, 0.7));
        curveConnector(p, Q.x, Q.y, c.x, c.y, 14, draw, A, 0.4 * draw, 1.3);
        const grow = easeOut(seg(now, 2.1 + i * 0.14, 0.5));
        dot(p, c.x, c.y, 3.4 + grow * 3.2, A, 0.35 + grow * 0.55, grow * 14);
      });
    }

    // flow into the model
    if (now > 3.4) {
      top.forEach((idx, i) => {
        const c = chunks[idx];
        const t = easeInOut(seg(now, 3.4 + i * 0.12, 0.95));
        if (t > 0 && t < 1) {
          const pt = bezierPt(c.x, c.y, L.x - boxW / 2, L.y, 18, t);
          token(p, pt.x, pt.y, 7, A, 0.85, 12);
        }
      });
    }

    // model box
    const lit = easeOut(seg(now, 3.6, 1.2));
    roundedBox(p, L.x, L.y, boxW, boxH, 12, INK, 0.18 + lit * 0.0, 0);
    roundedBox(p, L.x, L.y, boxW, boxH, 12, A, lit * 0.7, lit * 0.05, 1.6);
    label(p, L.x, L.y + boxH / 2 + 14, "model", INK, 0.3, 10);

    // answer
    const ans = easeOut(seg(now, 4.9, 1.0));
    if (ans > 0) {
      const ax = L.x + boxW / 2 + 16 + ans * 6;
      token(p, ax, L.y, 9 * ans, A, ans, 16 * ans);
      label(p, ax, L.y - 16, "answer", A, ans * 0.8, 10);
    }

    // query token on top
    const qFade = now < 0.7 ? easeOut(seg(now, 0, 0.6)) : now > 5.4 ? 1 - easeOut(seg(now, 5.4, 1.2)) : 1;
    token(p, qx, qy, 9, A, qFade, 14);
    if (now < 2.2) label(p, qx, qy - 16, "query", INK, qFade * 0.45, 10);
  };
};

export function NaiveSim({ color }: { color: string }) {
  return <P5Stage sketch={sketch} color={color} className="w-full" />;
}
