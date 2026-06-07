// Download eval results as JSON or CSV.
import type { EvalResults } from "./types";

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportJSON(results: EvalResults, label = "rag-atlas-eval") {
  download(`${label}.json`, JSON.stringify(results, null, 2), "application/json");
}

export function exportCSV(results: EvalResults, label = "rag-atlas-eval") {
  const headers = ["approach", "n", "em", "em_lo", "em_hi", "f1", "f1_lo", "f1_hi", "cost_usd", "tokens_in", "tokens_out", "p50_ms", "p95_ms"];
  const lines = [headers.join(",")];
  for (const r of results.headline) {
    lines.push(headers.map((h) => (r as unknown as Record<string, unknown>)[h] ?? "").join(","));
  }
  download(`${label}.csv`, lines.join("\n"), "text/csv");
}
