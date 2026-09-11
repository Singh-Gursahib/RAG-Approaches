"use client";

import type p5 from "p5";
import { P5Stage, type SketchFactory } from "./P5Stage";
import {
  INK,
  easeInOut,
  easeOut,
  hexToRgb,
  label,
  pulse,
  roundedBox,
  seg,
  token,
} from "./kit";

/**
 * Sliding-Window Reasoning — read the corpus one document at a time, carrying a
 * running "best answer" state forward; each window refines it; the final state
 * is the answer.
 */
const sketch: SketchFactory = (p: p5, ctx) => {
  const A = hexToRgb(ctx.color);
  const NDOCS = 4;
  const STEP = 1.9;
  const START = 0.8;
  const T = START + NDOCS * STEP + 2.2;

  let docs: { x: number; y: number; w: number; h: number }[] = [];
  let stateY = 0;
  let ansX = 0;

  const layout = () => {
    const W = p.width;
    const H = p.height;
    docs = [];
    const margin = W * 0.07;
    const gap = W * 0.03;
    const dw = (W - margin * 2 - gap * (NDOCS - 1)) / NDOCS;
    const dh = H * 0.34;
    for (let i = 0; i < NDOCS; i++) {
      docs.push({ x: margin + i * (dw + gap) + dw / 2, y: H * 0.34, w: dw, h: dh });
    }
    stateY = H * 0.72;
    ansX = W - margin;
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

    label(p, docs[0].x, p.height * 0.1, "read one document at a time →", INK, 0.32, 9, "left");

    // which window is active
    const activeF = (now - START) / STEP; // float index
    const activeIdx = Math.floor(activeF);

    docs.forEach((d, i) => {
      const visited = now > START + i * STEP + STEP * 0.5;
      const active = i === activeIdx && now >= START + i * STEP && now < START + (i + 1) * STEP;
      const glow = active ? pulse(now, START + i * STEP, STEP * 0.7) : 0;

      // doc panel
      roundedBox(p, d.x, d.y, d.w, d.h, 10, active || visited ? A : INK, active ? 0.4 + glow * 0.5 : visited ? 0.3 : 0.16, active ? 0.04 + glow * 0.04 : 0, 1.5);
      // text lines inside
      const lines = 5;
      for (let l = 0; l < lines; l++) {
        const ly = d.y - d.h / 2 + d.h * 0.2 + (l / lines) * d.h * 0.62;
        p.stroke(active || visited ? A.r : INK.r, active || visited ? A.g : INK.g, active || visited ? A.b : INK.b, (active ? 0.4 : visited ? 0.22 : 0.13) * 255);
        p.strokeWeight(2);
        p.line(d.x - d.w * 0.32, ly, d.x + d.w * 0.32 - (l === lines - 1 ? d.w * 0.18 : 0), ly);
      }
      label(p, d.x, d.y + d.h / 2 + 12, `doc ${i + 1}`, INK, active || visited ? 0.4 : 0.25, 8);
    });

    // running state token travels under the docs, updating at each
    // position: glides to the active doc's x
    let sx: number;
    if (now < START) sx = docs[0].x;
    else if (activeIdx >= NDOCS) sx = docs[NDOCS - 1].x;
    else {
      const prevX = activeIdx === 0 ? docs[0].x : docs[activeIdx - 1].x;
      const slide = easeInOut(seg(now, START + activeIdx * STEP, STEP * 0.4));
      sx = p.lerp(prevX, docs[Math.min(activeIdx, NDOCS - 1)].x, slide);
    }

    // connector from active doc down to state
    if (activeIdx >= 0 && activeIdx < NDOCS) {
      const d = docs[activeIdx];
      const drop = easeOut(seg(now, START + activeIdx * STEP, STEP * 0.45));
      p.stroke(A.r, A.g, A.b, 0.3 * 255 * drop);
      p.strokeWeight(1.3);
      p.line(d.x, d.y + d.h / 2, sx, p.lerp(d.y + d.h / 2, stateY, drop));
    }

    // the state token (pulses when it updates)
    const updatePulse = activeIdx >= 0 && activeIdx < NDOCS ? pulse(now, START + activeIdx * STEP + STEP * 0.4, STEP * 0.4) : 0;
    const sSize = 12 + updatePulse * 5;
    token(p, sx, stateY, sSize, A, 0.9, 12 + updatePulse * 12);
    label(p, sx, stateY + 20, "running state", INK, 0.4, 9);
    // refinement count ticks
    const refined = Math.min(NDOCS, Math.max(0, activeIdx + (now >= START + activeIdx * STEP + STEP * 0.4 ? 1 : 0)));
    for (let i = 0; i < NDOCS; i++) {
      p.noStroke();
      p.fill(A.r, A.g, A.b, (i < refined ? 0.7 : 0.18) * 255);
      p.circle(sx - 13 + i * 9, stateY - 20, 4);
    }

    // final answer
    if (now > START + NDOCS * STEP) {
      const ans = easeOut(seg(now, START + NDOCS * STEP, 1.0));
      const ax = p.lerp(docs[NDOCS - 1].x, ansX, ans);
      p.stroke(A.r, A.g, A.b, 0.3 * 255 * ans);
      p.strokeWeight(1.3);
      p.line(sx, stateY, ax, stateY);
      token(p, ax, stateY, 10 * ans, A, ans, 16 * ans);
      label(p, ax, stateY - 18, "answer", A, ans * 0.85, 10);
    }
  };
};

export function SlidingWindowSim({ color }: { color: string }) {
  return <P5Stage sketch={sketch} color={color} className="w-full" />;
}
