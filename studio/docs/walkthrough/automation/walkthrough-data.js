// Shared data for the walkthrough outputs (WALKTHROUGH.md and the Word guide):
// the capture log, the section layout, and the saved test results.
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const LOG = path.join(ROOT, "capture-log.jsonl");
const SHOTS = path.join(ROOT, "screenshots");
const DOC_IMAGES = path.join(SHOTS, "doc-images"); // written by prepare-doc-images.py
const RESULTS = path.resolve(ROOT, "..", "..", "results");

const LABELS = {
  full_context: "Full-Context",
  sliding_window: "Sliding-Window",
  hyde: "HyDE",
  naive: "Naive RAG",
  rerank: "Reranker",
  hybrid: "Hybrid RAG",
  recursive_summary: "Recursive Summary",
};
const RAG_APPROACHES = ["naive", "hybrid", "hyde", "rerank"];

// [first screenshot number, last screenshot number, title, introduction]
const SECTIONS = [
  [1, 2, "First visit", "Open http://localhost:3000. The first visit shows a short tour; skip it or step through it."],
  [3, 10, "Learn how each strategy works", "The home page animates all seven strategies. Pick one on the left to see how it moves a question through the corpus."],
  [11, 12, "Help and the OpenRouter key", "The header has a glossary and the key status pill. This walkthrough used a server-side key from the repository's .env file, so no key was typed into the browser."],
  [13, 22, "Playground: a first question on GLM 5.3 Flash", "The Playground runs one question through several strategies at once, on the model you choose."],
  [23, 23, "Compare", "Compare lays out the most recent Playground run side by side."],
  [24, 25, "Evaluate your own data", "Evaluate grades strategies on your own questions with known answers. This walkthrough shows the setup; the full graded test below uses Replay."],
  [26, 26, "Recommend", "Recommend suggests a starting strategy for a use case."],
  [27, 27, "History", "History keeps everything you have run in this browser."],
  [30, 33, "The GLM 5.3 Flash test: setup", "Replay reruns the paper's case study on a new model. The test used GLM 5.3 Flash with the paper's settings."],
  [34, 39, "The test in progress", "Progress updates live. Each bar counts graded answers for one strategy across all three runs."],
  [40, 51, "Results", "When the run finishes, the results are saved to disk and shown in full."],
  [52, 53, "History and Profiler after the test", "The finished test also appears in History and can be explored in the Profiler."],
  [54, 59, "Load the results from a previous test", "Saved tests can be reopened at any time without re-running anything."],
];

const pct = (v) => (v == null ? "n/a" : `${(v * 100).toFixed(1)}%`);
const pts = (v) => (v == null ? "" : ` ± ${(v * 100).toFixed(1)}`);
const usd = (v) => (v == null ? "n/a" : `$${v.toFixed(4)}`);

/** Latest capture of each screenshot name, in file order, keeping only files that exist. */
function readLog() {
  if (!fs.existsSync(LOG)) return [];
  const latest = new Map();
  for (const line of fs.readFileSync(LOG, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const e = JSON.parse(line);
    if (e.name && e.file && fs.existsSync(e.file)) latest.set(e.name, e);
  }
  return [...latest.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function sections(entries) {
  return SECTIONS.map(([lo, hi, title, intro]) => ({
    title,
    intro,
    entries: entries.filter((e) => {
      const num = parseInt(e.name.slice(0, 2), 10);
      return num >= lo && num <= hi;
    }),
  })).filter((s) => s.entries.length);
}

/** The full GLM 5.3 Flash replay, single-strategy follow-ups, and the paper's Gemini sweep. */
function readResults() {
  if (!fs.existsSync(RESULTS)) return { glm: null, followUps: [], paper: null };
  const all = fs
    .readdirSync(RESULTS)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ file: path.join(RESULTS, f), data: JSON.parse(fs.readFileSync(path.join(RESULTS, f), "utf8")) }));
  const byDate = (a, b) => String(a.data.created_at).localeCompare(String(b.data.created_at));
  const glmRuns = all.filter((r) => r.data.model?.id === "z-ai/glm-5.3-flash" && r.data.source === "replay").sort(byDate);
  const full = glmRuns.filter((r) => r.data.results.approaches.length === 7);
  return {
    glm: full[full.length - 1] || null,
    followUps: glmRuns.filter((r) => r.data.results.approaches.length < 7),
    paper: all.find((r) => r.data.id?.endsWith("paper-sweep")) || null,
  };
}

const headlineBy = (result) => Object.fromEntries(result.data.results.headline.map((h) => [h.approach, h]));

module.exports = { ROOT, LOG, SHOTS, DOC_IMAGES, RESULTS, LABELS, RAG_APPROACHES, SECTIONS, pct, pts, usd, readLog, sections, readResults, headlineBy };
