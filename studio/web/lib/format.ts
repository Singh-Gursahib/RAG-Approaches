// Formatting helpers — tabular, predictable, locale-stable.

export function fmtUSD(value: number, digits = 4): string {
  if (!isFinite(value)) return "—";
  return `$${value.toFixed(digits)}`;
}

export function fmtPct(value: number, digits = 1): string {
  if (!isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function fmtMs(ms: number): string {
  if (!isFinite(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function fmtTokens(n: number): string {
  if (!isFinite(n)) return "—";
  if (n < 1000) return `${n}`;
  return `${(n / 1000).toFixed(1)}k`;
}

export function fmtInt(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}
