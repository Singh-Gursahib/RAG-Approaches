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
 * HyDE — the model first drafts a hypothetical answer; that richer text is
 * embedded and drives retrieval, landing nearer the right chunks than the bare
 * query would. A faint "query alone" ghost shows the contrast.
 */
const sketch: SketchFactory = (p: p5, ctx) => {
  const A = hexToRgb(ctx.color);
  const T = 9.5;
  const K = 4;

  let chunks: { x: number; y: number }[] = [];
  let O = { x: 0, y: 0 };
  let Hn = { x: 0, y: 0 };
  let Qh = { x: 0, y: 0 };
  let Qb = { x: 0, y: 0 };
  let L = { x: 0, y: 0 };
  let boxW = 0;
  let boxH = 0;
  let nearH: number[] = [];
  let nearB: number[] = [];

  const layout = () => {
    const W = p.width;
    const H = p.height;
    const r = rng(11);
    chunks = [];
    // a dense cluster (good for the hypothetical) + scattered fillers
    for (let i = 0; i < 8; i++)
      chunks.push({ x: W * 0.56 + (r() - 0.5) * W * 0.12, y: H * 0.4 + (r() - 0.5) * H * 0.28 });
    for (let i = 0; i < 14; i++)
      chunks.push({ x: W * 0.42 + r() * W * 0.32, y: H * 0.14 + r() * H * 0.72 });
    O = { x: W * 0.09, y: H * 0.62 };
    Hn = { x: W * 0.27, y: H * 0.26 };
    Qh = { x: W * 0.56, y: H * 0.4 }; // hypothetical lands in the cluster
    Qb = { x: W * 0.46, y: H * 0.8 }; // bare query lands in a sparse area
    L = { x: W * 0.9, y: H * 0.5 };
    boxW = W * 0.12;
    boxH = H * 0.4;
    const nearest = (q: { x: number; y: number }, k: number) =>
      chunks
        .map((c, i) => ({ i, d: Math.hypot(c.x - q.x, c.y - q.y) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, k)
        .map((o) => o.i);
    nearH = nearest(Qh, K);
    nearB = nearest(Qb, 1);
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

  // a "passage" token: rounded rect with little text lines inside
  const passage = (x: number, y: number, w: number, h: number, a: number, glow: number) => {
    const ctx2 = p.drawingContext as CanvasRenderingContext2D;
    ctx2.save();
    ctx2.shadowBlur = glow;
    ctx2.shadowColor = `rgba(${A.r},${A.g},${A.b},${a * 0.9})`;
    p.noStroke();
    p.fill(A.r, A.g, A.b, a * 235);
    p.rect(x - w / 2, y - h / 2, w, h, 4);
    ctx2.restore();
    p.stroke(255, 255, 255, a * 220);
    p.strokeWeight(1);
    for (let i = 0; i < 3; i++) p.line(x - w / 2 + 4, y - h / 2 + 5 + i * 5, x + w / 2 - 4 - (i === 2 ? 6 : 0), y - h / 2 + 5 + i * 5);
  };

  p.draw = () => {
    const now = ctx.reduced ? T * 0.62 : (p.millis() / 1000) % T;
    p.clear();

    label(p, p.width * 0.58, p.height * 0.075, "corpus", INK, 0.3, 10);
    const hSet = new Set(nearH);
    const bSet = new Set(nearB);
    chunks.forEach((c, i) => {
      if ((hSet.has(i) && now > 3.8) || (bSet.has(i) && now > 3.8)) return;
      dot(p, c.x, c.y, 3.2, INK, 0.15);
    });

    // 1) query → HyDE model
    const toModel = easeInOut(seg(now, 0.7, 1.0));
    if (now > 0.7) curveConnector(p, O.x, O.y, Hn.x, Hn.y, 30, easeOut(seg(now, 0.7, 0.9)), INK, 0.18, 1.2);

    // HyDE model node
    const nodeLit = easeOut(seg(now, 1.5, 0.8));
    roundedBox(p, Hn.x, Hn.y, p.width * 0.11, p.height * 0.16, 9, A, 0.3 + nodeLit * 0.5, nodeLit * 0.06, 1.5);
    label(p, Hn.x, Hn.y - p.height * 0.115, "model · imagine", INK, 0.34, 9);

    // 2) hypothetical passage emerges + travels to the cluster
    const emerge = easeOut(seg(now, 1.7, 0.8));
    const travel = easeInOut(seg(now, 2.6, 1.2));
    if (now > 1.7 && now < 3.9) {
      const sx = Hn.x;
      const sy = Hn.y + p.height * 0.05;
      const pt = bezierPt(sx, sy, Qh.x, Qh.y, 30, travel);
      const w = p.width * (0.05 + emerge * 0.025);
      const h = p.height * 0.07;
      passage(pt.x, pt.y, w, h, Math.min(1, emerge), 14);
      if (now < 2.7) label(p, sx, sy + h, "hypothetical", A, emerge * 0.8, 9);
    }

    // ghost: bare query alone (faint, weak)
    const ghost = easeOut(seg(now, 2.8, 1.0));
    if (ghost > 0) {
      p.push();
      p.drawingContext.setLineDash([3, 4]);
      curveConnector(p, O.x, O.y, Qb.x, Qb.y, -20, ghost, INK, 0.14, 1);
      p.drawingContext.setLineDash([]);
      p.pop();
      dot(p, Qb.x, Qb.y, 4, INK, 0.25 * ghost);
      label(p, Qb.x, Qb.y + 16, "query alone", INK, 0.3 * ghost, 8);
    }

    // 3) retrieval
    if (now > 3.8) {
      nearH.forEach((idx, i) => {
        const c = chunks[idx];
        const draw = easeOut(seg(now, 3.8 + i * 0.12, 0.6));
        curveConnector(p, Qh.x, Qh.y, c.x, c.y, 12, draw, A, 0.4 * draw, 1.3);
        const g = easeOut(seg(now, 3.8 + i * 0.12, 0.5));
        dot(p, c.x, c.y, 3.2 + g * 3, A, 0.4 + g * 0.5, g * 13);
      });
      // bare query: only one weak hit
      nearB.forEach((idx) => {
        const c = chunks[idx];
        const g = easeOut(seg(now, 4, 0.5));
        dot(p, c.x, c.y, 3.4, INK, 0.3 * g);
      });
    }

    // 4) flow to model
    if (now > 5.0) {
      nearH.forEach((idx, i) => {
        const c = chunks[idx];
        const t = easeInOut(seg(now, 5.0 + i * 0.1, 0.95));
        if (t > 0 && t < 1) {
          const pt = bezierPt(c.x, c.y, L.x - boxW / 2, L.y, 14, t);
          token(p, pt.x, pt.y, 6, A, 0.82, 11);
        }
      });
    }

    const lit = easeOut(seg(now, 5.3, 1.0));
    roundedBox(p, L.x, L.y, boxW, boxH, 12, INK, 0.18, 0);
    roundedBox(p, L.x, L.y, boxW, boxH, 12, A, lit * 0.7, lit * 0.05, 1.6);
    label(p, L.x, L.y + boxH / 2 + 14, "model", INK, 0.3, 10);
    const ans = easeOut(seg(now, 6.4, 1.0));
    if (ans > 0) {
      const ax = L.x + boxW / 2 + 14 + ans * 6;
      token(p, ax, L.y, 9 * ans, A, ans, 16 * ans);
      label(p, ax, L.y - 16, "answer", A, ans * 0.8, 10);
    }

    // query token
    const qFade = now < 0.7 ? easeOut(seg(now, 0, 0.6)) : now > 6 ? 1 - easeOut(seg(now, 6, 1.6)) : 1;
    token(p, O.x, O.y, 9, A, qFade, 14);
    if (now < 1.4) label(p, O.x, O.y + 16, "query", INK, qFade * 0.45, 10);
    void toModel;
  };
};

export function HydeSim({ color }: { color: string }) {
  return <P5Stage sketch={sketch} color={color} className="w-full" />;
}
