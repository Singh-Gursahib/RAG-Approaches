"use client";

import type p5 from "p5";
import { P5Stage, type SketchFactory } from "./P5Stage";
import {
  INK,
  bezierPt,
  dot,
  easeInOut,
  easeOut,
  hexToRgb,
  label,
  roundedBox,
  seg,
  token,
} from "./kit";

/**
 * Full-Context Injection — no retrieval at all. The entire corpus streams into
 * a single prompt; the context window fills; the model answers.
 */
const sketch: SketchFactory = (p: p5, ctx) => {
  const A = hexToRgb(ctx.color);
  const T = 8.5;
  const COLS = 7;
  const ROWS = 4;
  const N = COLS * ROWS;

  let grid: { x: number; y: number }[] = [];
  let L = { x: 0, y: 0 };
  let boxW = 0;
  let boxH = 0;

  const arriveStart = (i: number) => 1.0 + (i / N) * 3.0;
  const arriveDur = 0.9;

  const layout = () => {
    const W = p.width;
    const H = p.height;
    grid = [];
    const x0 = W * 0.08;
    const x1 = W * 0.4;
    const y0 = H * 0.2;
    const y1 = H * 0.8;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        grid.push({ x: p.lerp(x0, x1, c / (COLS - 1)), y: p.lerp(y0, y1, r / (ROWS - 1)) });
    L = { x: W * 0.76, y: H * 0.5 };
    boxW = W * 0.34;
    boxH = H * 0.64;
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
    const now = ctx.reduced ? T * 0.65 : (p.millis() / 1000) % T;
    p.clear();

    label(p, p.width * 0.24, p.height * 0.115, "entire corpus — no retrieval", INK, 0.32, 9);

    // model box + context-window meter
    roundedBox(p, L.x, L.y, boxW, boxH, 14, INK, 0.2, 0.0);
    label(p, L.x, L.y - boxH / 2 - 12, "model · single prompt", INK, 0.32, 9);

    // count arrived
    let arrived = 0;
    grid.forEach((g, i) => {
      const t = easeInOut(seg(now, arriveStart(i), arriveDur));
      if (t >= 1) arrived++;
      if (t <= 0) {
        dot(p, g.x, g.y, 3.4, INK, 0.18); // waiting in corpus
      } else if (t < 1) {
        const target = {
          x: L.x - boxW / 2 + (boxW * 0.18) + ((i % COLS) / COLS) * boxW * 0.6,
          y: L.y - boxH * 0.22 + Math.floor(i / COLS) * (boxH * 0.12),
        };
        const pt = bezierPt(g.x, g.y, target.x, target.y, 22, t);
        token(p, pt.x, pt.y, 6, A, 0.8, 10);
      } else {
        // settled inside the box
        const target = {
          x: L.x - boxW / 2 + boxW * 0.18 + ((i % COLS) / COLS) * boxW * 0.6,
          y: L.y - boxH * 0.22 + Math.floor(i / COLS) * (boxH * 0.12),
        };
        dot(p, target.x, target.y, 3, A, 0.5, 6);
      }
    });

    // context-window fill bar inside the box
    const frac = (arrived / N) * 0.94;
    const barX = L.x - boxW / 2 + boxW * 0.1;
    const barY = L.y + boxH / 2 - boxH * 0.16;
    const barW = boxW * 0.8;
    p.noStroke();
    p.fill(INK.r, INK.g, INK.b, 0.08 * 255);
    p.rect(barX, barY, barW, 8, 4);
    p.fill(A.r, A.g, A.b, 0.7 * 255);
    p.rect(barX, barY, barW * frac, 8, 4);
    label(p, barX, barY - 12, "context window", INK, 0.3, 8, "left");
    label(p, barX + barW, barY - 12, `${Math.round(frac * 100)}%`, A, 0.55, 8, "right");

    // answer once full
    const full = arrived >= N - 1;
    const ans = easeOut(seg(now, arriveStart(N - 1) + 0.6, 1.0));
    if (full && ans > 0) {
      const ax = L.x + boxW / 2 + 16 + ans * 6;
      token(p, ax, L.y, 9 * ans, A, ans, 16 * ans);
      label(p, ax, L.y - 16, "answer", A, ans * 0.8, 10);
    }
  };
};

export function FullContextSim({ color }: { color: string }) {
  return <P5Stage sketch={sketch} color={color} className="w-full" />;
}
