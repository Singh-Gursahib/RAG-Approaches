// Builds ../WALKTHROUGH.md from ../capture-log.jsonl and the saved test results.
// Every screenshot is listed with its absolute path.
const fs = require("fs");
const path = require("path");
const { ROOT, LABELS, pct, pts, usd, readLog, sections, readResults } = require("./walkthrough-data");

const OUT = path.join(ROOT, "WALKTHROUGH.md");

function resultsSection({ glm, paper, followUps }) {
  if (!glm) return "";
  const g = glm.data;
  const byApproach = new Map((paper?.data.results.headline || []).map((h) => [h.approach, h]));
  const rows = [...g.results.headline].sort((a, b) => b.f1 - a.f1);
  const lines = [
    "## Test record",
    "",
    `- Saved result file: \`${glm.file}\``,
    paper ? `- Paper sweep file (Gemini 3 Flash): \`${paper.file}\`` : null,
    `- Model: ${g.model.label} (\`${g.model.id}\`), ${g.model.open_weights ? "open weights" : "proprietary"}, via OpenRouter`,
    `- Settings: temperature ${g.config.temperature}, ${g.config.repeats} runs (seeds ${g.config.seeds.join(", ")}), reasoning ${g.config.reasoning_effort_sent ?? g.config.reasoning_requested}, ${g.config.answer_token_budget}-token answer budget (max_tokens sent ${g.config.max_tokens_sent}), top-k ${g.config.retrieval.top_k}, rerank pool ${g.config.retrieval.top_n_for_rerank}, chunks of ${g.config.chunking.target_tokens} tokens with ${g.config.chunking.overlap_tokens} overlap`,
    `- Dataset: ${g.dataset.name}, ${g.dataset.n_docs} documents, ${g.dataset.n_questions} questions, ${g.results.headline[0]?.n ?? "?"} graded answers per strategy`,
    `- Runtime: ${g.runtime.wall_s != null ? `${(g.runtime.wall_s / 60).toFixed(1)} minutes` : "n/a"}, ${g.runtime.llm_calls ?? "n/a"} model calls, ${g.runtime.reasoning_tokens ?? "n/a"} reasoning tokens, total cost ${usd(g.runtime.total_cost_usd)}`,
    `- App attribution headers sent to OpenRouter: ${g.config.attribution_headers_sent ? "yes" : "none"}`,
    "",
    "| Strategy | GLM 5.3 Flash F1 | Gemini 3 Flash F1 (paper) | Δ F1 | GLM EM | Paper EM | GLM cost / run | Paper cost / run |",
    "|---|---|---|---|---|---|---|---|",
  ].filter((l) => l !== null);
  for (const h of rows) {
    const p = byApproach.get(h.approach);
    const delta = p ? `${h.f1 - p.f1 >= 0 ? "+" : ""}${((h.f1 - p.f1) * 100).toFixed(1)}` : "n/a";
    lines.push(
      `| ${LABELS[h.approach] ?? h.approach} | ${pct(h.f1)}${pts(h.f1_seed_std)} | ${p ? pct(p.f1) + pts(p.f1_seed_std) : "n/a"} | ${delta} | ${pct(h.em)} | ${p ? pct(p.em) : "n/a"} | ${usd(h.cost_usd)} | ${p ? usd(p.cost_usd) : "n/a"} |`,
    );
  }
  lines.push("", "F1 and EM are means of the runs, ± the run-to-run standard deviation.", "");
  if (followUps.length) {
    lines.push("### Follow-up runs", "");
    for (const f of followUps) {
      const d = f.data;
      for (const h of d.results.headline) {
        lines.push(
          `- ${d.label}: ${LABELS[h.approach] ?? h.approach} F1 ${pct(h.f1)}${pts(h.f1_seed_std)}, EM ${pct(h.em)}, cost per run ${usd(h.cost_usd)}, reasoning ${d.config.reasoning_effort_sent ?? d.config.reasoning_requested} (max_tokens ${d.config.max_tokens_sent}), ${d.runtime.truncation_retries} truncation retries. File: \`${f.file}\``,
        );
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

function main() {
  const entries = readLog();
  const out = [
    "# RAG Atlas walkthrough: testing GLM 5.3 Flash",
    "",
    "This document follows RAG Atlas step by step, from the first visit to a full replay of the paper's case study on GLM 5.3 Flash, and ends by reopening the saved results. Every screenshot is listed with its absolute path.",
    "",
    "## Before you start",
    "",
    "- Start both servers from the repository root: `.venv/bin/uvicorn studio.server.app.main:app --port 8000` and `cd studio/web && npm run dev`, then open http://localhost:3000.",
    "- Add an OpenRouter API key with the key pill in the header, or put `OPENROUTER_API_KEY` in the repository's `.env` file. This walkthrough used the `.env` option, so the key never appears on screen.",
    "- RAG Atlas sends only the key and content type to OpenRouter. It sends no app name, referrer, or other attribution.",
    `- Screenshots were captured on ${entries[0] ? new Date(entries[0].at).toUTCString() : "n/a"} at 1440 × 900 (2× scale) with Chrome.`,
    "",
    resultsSection(readResults()),
  ];

  let step = 1;
  for (const section of sections(entries)) {
    out.push(`## ${section.title}`, "", section.intro, "");
    for (const e of section.entries) {
      out.push(`### Step ${step++}. ${e.step}`, "", e.caption || "", "");
      if (e.progress_text) out.push(`Progress at capture time: ${e.progress_text}`, "");
      if (e.identical_to_live_run !== undefined) {
        out.push(`Leaderboard identical to the live run: ${e.identical_to_live_run ? "yes" : "no"}.`, "");
      }
      out.push(`![${e.step}](${path.relative(ROOT, e.file)})`, "", `Screenshot: \`${e.file}\``, "");
    }
  }

  fs.writeFileSync(OUT, out.join("\n"));
  console.log(`Wrote ${OUT} with ${entries.length} screenshots.`);
}

main();
