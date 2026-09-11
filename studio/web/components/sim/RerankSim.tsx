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
 * Cross-encoder reranking — cast a wide net (top-20), re-score every candidate
 * against the query, reorder, and keep only the top-5 for generation.
 */
const sketch: SketchFactory = (p: p5, ctx) => {
  const A = hexToRgb(ctx.color);
  const T = 9.5;
  const N = 12;
  const KEEP = 5;

  let cand: { cx: number; cy: number; score: number; orig: number; rank: number }[] = [];
  let O = { x: 0, y: 0 };
  let colX = 0;
  let slotY: number[] = [];
  let L = { x: 0, y: 0 };
  let boxW = 0;
  let boxH = 0;

  const layout = () => {
    const W = p.width;
    const H = p.height;
    const r = rng(23);
    cand = [];
    for (let i = 0; i < N; i++) {
      cand.push({
        cx: W * 0.2 + r() * W * 0.2,
        cy: H * 0.18 + r() * H * 0.64,
        score: 0.2 + r() * 0.8,
        orig: i,
        rank: 0,
      });
    }
    [...cand]
      .sort((a, b) => b.score - a.score)
      .forEach((c, rank) => (c.rank = rank));
    colX = W * 0.56;
    slotY = [];
    for (let i = 0; i < N; i++) slotY.push(p.lerp(H * 0.15, H * 0.85, i / (N - 1)));
    O = { x: W * 0.08, y: H * 0.5 };
    L = { x: W * 0.9, y: H * 0.5 };
    boxW = W * 0.12;
    boxH = H * 0.42;
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
    const now = ctx.reduced ? T * 0.7 : (p.millis() / 1000) % T;
    p.clear();

    // phase progress
    const net = easeOut(seg(now, 0.7, 1.2)); // wide net highlight
    const arrive = easeInOut(seg(now, 2.2, 1.1)); // move into column (original order)
    const bars = easeOut(seg(now, 3.5, 0.8)); // score bars grow
    const sortP = easeInOut(seg(now, 4.3, 0.9)); // reorder to sorted

    label(p, p.width * 0.3, p.height * 0.085, "top-20 candidates", INK, 0.3, 9);
    label(p, colX + 4, p.height * 0.07, "cross-encoder rescoring", A, 0.32 * easeOut(seg(now, 3.4, 0.8)), 9, "left");

    // reranker column guide
    if (now > 2.0) {
      p.stroke(INK.r, INK.g, INK.b, 0.1 * 255 * easeOut(seg(now, 2.0, 0.6)));
      p.strokeWeight(1);
      p.line(colX, p.height * 0.13, colX, p.height * 0.87);
    }

    cand.forEach((c) => {
      // position: cloud → column(original order) → column(sorted)
      const slotOrig = slotY[c.orig];
      const slotSorted = slotY[c.rank];
      const colY = p.lerp(slotOrig, slotSorted, sortP);
      const x = p.lerp(c.cx, colX, arrive);
      const y = p.lerp(c.cy, colY, arrive);

      const kept = c.rank < KEEP;
      // base / net highlight
      let a = 0.16 + net * 0.3;
      let col = net > 0 ? A : INK;
      // after sort, dim the losers, brighten the keepers
      if (sortP > 0.2) {
        const fade = sortP;
        if (kept) {
          a = 0.5 + fade * 0.45;
          col = A;
        } else {
          a = p.lerp(0.5, 0.12, fade);
          col = INK;
        }
      } else if (arrive > 0) {
        a = 0.45;
        col = A;
      }
      dot(p, x, y, kept && sortP > 0.3 ? 4 + sortP * 2 : 4, col, a, col === A ? a * 14 : 0);

      // query → candidate net lines (phase 1 only)
      if (now < 2.3 && net > 0) {
        curveConnector(p, O.x, O.y, c.cx, c.cy, 8, net, A, 0.18 * net, 1);
      }

      // score bar in the column
      if (bars > 0 && arrive > 0.6) {
        const barLen = c.score * p.width * 0.16 * bars;
        p.noStroke();
        p.fill(kept ? A.r : INK.r, kept ? A.g : INK.g, kept ? A.b : INK.b, (kept ? 0.6 : 0.18) * 255 * (sortP > 0.2 ? (kept ? 1 : 0.5) : 1));
        p.rect(x + 8, y - 2.5, barLen, 5, 2.5);
      }
    });

    if (sortP > 0.4) label(p, colX + p.width * 0.09, p.height * 0.9, "top-5 kept", A, 0.35, 9);

    // top-5 flow to model
    if (now > 5.2) {
      cand
        .filter((c) => c.rank < KEEP)
        .forEach((c, i) => {
          const t = easeInOut(seg(now, 5.2 + i * 0.1, 0.95));
          if (t > 0 && t < 1) {
            const pt = bezierPt(colX, slotY[c.rank], L.x - boxW / 2, L.y, 10, t);
            token(p, pt.x, pt.y, 6, A, 0.82, 11);
          }
        });
    }

    const lit = easeOut(seg(now, 5.5, 1.0));
    roundedBox(p, L.x, L.y, boxW, boxH, 12, INK, 0.18, 0);
    roundedBox(p, L.x, L.y, boxW, boxH, 12, A, lit * 0.7, lit * 0.05, 1.6);
    label(p, L.x, L.y + boxH / 2 + 14, "model", INK, 0.3, 10);
    const ans = easeOut(seg(now, 6.6, 1.0));
    if (ans > 0) {
      const ax = L.x + boxW / 2 + 14 + ans * 6;
      token(p, ax, L.y, 9 * ans, A, ans, 16 * ans);
      label(p, ax, L.y - 16, "answer", A, ans * 0.8, 10);
    }

    // query token
    const qFade = now < 0.7 ? easeOut(seg(now, 0, 0.6)) : now > 6 ? 1 - easeOut(seg(now, 6, 1.6)) : 1;
    token(p, O.x, O.y, 9, A, qFade, 14);
    if (now < 2.3) label(p, O.x, O.y - 16, "query", INK, qFade * 0.45, 10);
  };
};

export function RerankSim({ color }: { color: string }) {
  return <P5Stage sketch={sketch} color={color} className="w-full" />;
}
