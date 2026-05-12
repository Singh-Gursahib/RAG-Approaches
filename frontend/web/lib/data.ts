import raw from "./data.json";
import type { DashboardData } from "./types";

// Build-time-loaded. Re-run `python scripts/build_dashboard_data.py` to refresh.
export const data = raw as unknown as DashboardData;

export function fmtPct(x: number, digits = 1): string {
  return `${(x * 100).toFixed(digits)}%`;
}

export function fmtUSD(x: number, digits = 4): string {
  return `$${x.toFixed(digits)}`;
}

export function fmtMs(x: number): string {
  if (x < 1000) return `${Math.round(x)}ms`;
  return `${(x / 1000).toFixed(1)}s`;
}

export function fmtCompact(x: number): string {
  if (x >= 1_000_000) return `${(x / 1_000_000).toFixed(1)}M`;
  if (x >= 1_000) return `${(x / 1_000).toFixed(1)}k`;
  return x.toString();
}
