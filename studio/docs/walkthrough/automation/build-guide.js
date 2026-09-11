// Builds ../RAG-Atlas-User-Guide.docx: a task-by-task guide to RAG Atlas, illustrated with the
// walkthrough screenshots and a worked example on GLM 5.3 Flash. Screenshots are embedded;
// the document does not refer to any files on disk.
const fs = require("fs");
const path = require("path");
const {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} = require("docx");
const data = require("./walkthrough-data");

const OUT = path.join(data.ROOT, "RAG-Atlas-User-Guide.docx");
const CONTENT_W = 9360; // DXA: US Letter with 1-inch margins
const DXA_TO_PX = 1 / 15; // 1440 DXA = 1 inch = 96 px
const FULL = { maxW: 624, maxH: 430 }; // a full-width figure: 6.5 x 4.5 inches at most
const INK = "1A1A1A";
const MUTED = "5F5A52";
const FAINT = "8A847A";
const ACCENT = "CF4520";
const LINE = "D9D4CA";
const SOFT = "F4F1EA";

const manifest = JSON.parse(fs.readFileSync(path.join(data.DOC_IMAGES, "manifest.json"), "utf8"));
let figureNo = 0;

// --- text building blocks ------------------------------------------------------

const run = (text, opts = {}) => new TextRun({ text, ...opts });
const runs = (content) => (Array.isArray(content) ? content : [run(content)]);
const p = (content, opts = {}) => new Paragraph({ children: runs(content), spacing: { after: 140, line: 276 }, ...opts });
// Chapters flow on without forced page breaks, so short chapters don't leave half-empty pages.
const h1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, spacing: { before: 520, after: 200 }, children: [run(text)] });
const h2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [run(text)] });
const lead = (content) => p(content, { keepNext: true });
const bullet = (content) =>
  new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 70, line: 276 }, children: runs(content) });
const numbered = (content) =>
  new Paragraph({ numbering: { reference: "steps", level: 0 }, spacing: { after: 70, line: 276 }, children: runs(content) });
const bold = (text) => run(text, { bold: true });
const code = (text) =>
  new Paragraph({
    children: [run(text, { font: "Courier New", size: 18, color: INK })],
    shading: { type: ShadingType.CLEAR, color: "auto", fill: SOFT },
    indent: { left: 240, right: 240 },
    spacing: { before: 0, after: 0 },
  });
const gap = (after = 120) => new Paragraph({ children: [], spacing: { after } });

// --- figures ---------------------------------------------------------------------------

function imageFile(name, part = 1) {
  const files = Object.keys(manifest)
    .filter((f) => f === `${name}.jpg` || f.startsWith(`${name}--part`))
    .sort();
  if (!files.length) throw new Error(`No prepared image for ${name}`);
  return files[Math.min(part, files.length) - 1];
}

function imageRun(name, { part, maxW, maxH }) {
  const file = imageFile(name, part);
  const [w, h, originalWidth] = manifest[file];
  const onScreenWidth = (originalWidth / 2) * 0.85; // never larger than the capture looked on screen
  const scale = Math.min(maxW / w, maxH / h, onScreenWidth / w);
  return new ImageRun({
    type: "jpg",
    data: fs.readFileSync(path.join(data.DOC_IMAGES, file)),
    transformation: { width: Math.round(w * scale), height: Math.round(h * scale) },
    altText: { title: name, description: name, name },
  });
}

function captionParagraph(text, after = 260) {
  figureNo += 1;
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after },
    children: [run(`Figure ${figureNo}. `, { bold: true, size: 17, color: MUTED }), run(text, { size: 17, color: MUTED })],
  });
}

/** One full-width screenshot with its caption. */
function figure(name, caption, opts = {}) {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      keepNext: true,
      spacing: { before: 100, after: 0 },
      children: [imageRun(name, { ...FULL, ...opts })],
    }),
    captionParagraph(caption),
  ];
}

/** Screenshots side by side, two per row, each with its own caption. */
function grid(cells, { maxH = 300 } = {}) {
  const colW = CONTENT_W / 2;
  const innerPx = Math.floor((colW - 240) * DXA_TO_PX);
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const rows = [];
  for (let i = 0; i < cells.length; i += 2) {
    const pair = cells.slice(i, i + 2);
    rows.push(
      new TableRow({
        cantSplit: true,
        children: [0, 1].map((k) => {
          const cell = pair[k];
          return new TableCell({
            width: { size: colW, type: WidthType.DXA },
            borders: { top: none, bottom: none, left: none, right: none },
            margins: { top: 80, bottom: 120, left: 120, right: 120 },
            verticalAlign: VerticalAlign.TOP,
            children: cell
              ? [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 0 },
                    children: [imageRun(cell.image, { part: cell.part, maxW: innerPx, maxH: cell.maxH ?? maxH })],
                  }),
                  captionParagraph(cell.caption, 40),
                ]
              : [new Paragraph({ children: [] })],
          });
        }),
      }),
    );
  }
  return [
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [colW, colW],
      borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
      rows,
    }),
    gap(160),
  ];
}

function table(headers, rows, widths, { align = [], size = 18 } = {}) {
  const total = widths.reduce((a, b) => a + b, 0);
  const edge = { style: BorderStyle.SINGLE, size: 4, color: LINE };
  const borders = { top: edge, bottom: edge, left: edge, right: edge };
  const cell = (value, i, header) =>
    new TableCell({
      width: { size: widths[i], type: WidthType.DXA },
      borders,
      shading: header ? { type: ShadingType.CLEAR, color: "auto", fill: SOFT } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [
        new Paragraph({
          alignment: align[i] === "right" ? AlignmentType.RIGHT : AlignmentType.LEFT,
          children: [run(String(value), { bold: header || (i === 0 && align[0] === "strong"), size, color: INK })],
        }),
      ],
    });
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, i, true)) }),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((v, i) => cell(v, i, false)) })),
    ],
  });
}

// --- chapters --------------------------------------------------------------------------

function titlePage(date) {
  return [
    new Paragraph({ spacing: { before: 2600, after: 120 }, children: [run("RAG Atlas", { size: 80, bold: true, color: INK })] }),
    new Paragraph({ spacing: { after: 480 }, children: [run("User Guide", { size: 52, color: ACCENT })] }),
    p([
      run("How to compare retrieval strategies on your own documents with any model on OpenRouter, with a complete worked example on GLM 5.3 Flash.", {
        size: 28,
        color: MUTED,
      }),
    ]),
    new Paragraph({ spacing: { before: 1600, after: 60 }, children: [run("A companion to the RAG_Ureap research framework", { size: 20, color: MUTED })] }),
    p([run(date, { size: 20, color: MUTED })]),
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({ spacing: { after: 200 }, children: [run("Contents", { size: 36, bold: true, color: INK })] }),
    new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-2" }),
    p([run("If the list above is empty, right-click it and choose Update Field.", { size: 16, color: FAINT, italics: true })]),
  ];
}

function introduction() {
  return [
    h1("1. What RAG Atlas does"),
    p(
      "RAG Atlas is an interactive studio for comparing ways of answering questions from documents. It runs up to seven strategies on the same documents and the same model, and shows the answers side by side with what each strategy retrieved, how long it took, and what it cost. With questions that have known answers, it grades every strategy the way the RAG_Ureap paper does.",
    ),
    h2("The seven strategies"),
    table(
      ["Strategy", "Family", "How it answers", "Typically good for"],
      [
        ["Naive RAG", "Retrieval", "Finds the five passages closest to the question and answers from them.", "Simple lookups, lowest cost"],
        ["Hybrid RAG", "Retrieval", "Combines keyword search with vector search and merges the two rankings.", "Exact names, codes, and identifiers"],
        ["HyDE", "Retrieval", "Drafts a hypothetical answer first and uses it as the search query.", "Questions worded unlike the documents"],
        ["Reranker", "Retrieval", "Retrieves twenty candidates, re-scores them, and keeps the best five.", "Many passages that look alike"],
        ["Full-Context", "Non-retrieval", "Places every document in a single prompt.", "Collections that fit in the model's context"],
        ["Recursive Summary", "Non-retrieval", "Summarizes each document once and answers from the summaries.", "Overviews and synthesis"],
        ["Sliding-Window", "Non-retrieval", "Reads one document at a time, carrying a running answer forward.", "Long documents read in order"],
      ],
      [1750, 1300, 3960, 2350],
      { size: 17 },
    ),
    gap(160),
    h2("Where to find things"),
    bullet([bold("Home: "), run("animated simulations of every strategy.")]),
    bullet([bold("Playground: "), run("ask one question and watch several strategies answer it.")]),
    bullet([bold("Compare: "), run("study the last Playground run side by side.")]),
    bullet([bold("Evaluate: "), run("grade strategies on your own questions with known answers.")]),
    bullet([bold("Replay: "), run("rerun the paper's case study on any model.")]),
    bullet([bold("Profiler: "), run("weigh cost, quality, and speed, and re-price a run for another model.")]),
    bullet([bold("Recommend: "), run("get a suggested starting strategy for a use case.")]),
    bullet([bold("History: "), run("reopen past runs, evaluations, and saved configurations.")]),
  ];
}

function gettingStarted() {
  return [
    h1("2. Getting started"),
    h2("2.1 Requirements"),
    bullet("Python 3.11 or newer and Node.js 18 or newer."),
    bullet([run("An OpenRouter API key, created at "), run("openrouter.ai/keys", { color: ACCENT }), run(".")]),
    h2("2.2 Install once"),
    lead("From the repository root:"),
    code("python3 -m venv .venv"),
    code('.venv/bin/pip install -e ".[dev]"'),
    code(".venv/bin/pip install -r studio/server/requirements.txt"),
    code("cd studio/web && npm install"),
    gap(),
    h2("2.3 Start the app"),
    lead("From the repository root, start both servers with one command:"),
    code("./studio/run.sh"),
    gap(),
    p("Then open http://localhost:3000 in a browser. The first run downloads the local search models once; only the model calls to OpenRouter cost money."),
    h2("2.4 Add your OpenRouter key"),
    lead("Click the key pill at the right of the header. There are two ways to provide a key:"),
    numbered([bold("In the browser: "), run("paste the key and press Test key. It is kept only in that browser tab.")]),
    numbered([
      bold("On the server: "),
      run("add "),
      run("OPENROUTER_API_KEY=your-key", { font: "Courier New", size: 18 }),
      run(" to the .env file in the repository root. The pill then reads Server key and nothing needs to be typed in the browser."),
    ]),
    ...figure("12-openrouter-key-dialog", "The key dialog, here showing that a server-side key is already configured.", { maxH: 330 }),
    h2("2.5 Privacy"),
    bullet("The key is never written to disk, logged, or sent back by the server."),
    bullet("Model calls go from the server straight to OpenRouter with only the key attached. No app name, referrer, or other attribution is sent."),
    bullet("Finished tests are saved on the machine running RAG Atlas. They contain settings and results, never the key."),
  ];
}

function exploreChapter() {
  return [
    h1("3. Explore the app"),
    h2("3.1 The home page"),
    lead("The header holds the navigation, the backend status, a help button that opens the glossary, and the key pill. On a first visit a short tour introduces the main steps."),
    ...figure("02-home-hero", "The home page."),
    ...grid([
      { image: "01-onboarding-tour", caption: "The first-visit tour." },
      { image: "11-glossary", caption: "The glossary, opened from the help button." },
    ]),
    h2("3.2 Strategy simulations"),
    lead(
      "Below the introduction, the home page has an animated simulation for each strategy. Choose a strategy from the list on the left to play its animation. Each one comes with a plain-language explanation, what the strategy is best for, where it struggles, and how expensive it is. The images below show one moment of each animation.",
    ),
    ...grid(
      [
        { image: "g-sim-naive-rag", caption: "Naive RAG: the nearest passages go straight to the model." },
        { image: "g-sim-hybrid-rag", caption: "Hybrid RAG: keyword and vector rankings are fused." },
        { image: "g-sim-hyde", caption: "HyDE: a drafted answer becomes the search query." },
        { image: "g-sim-reranker", caption: "Reranker: twenty candidates are narrowed to five." },
        { image: "g-sim-full-context", caption: "Full-Context: the whole corpus in one prompt." },
        { image: "g-sim-recursive-summary", caption: "Recursive Summary: answers come from document summaries." },
        { image: "g-sim-sliding-window", caption: "Sliding-Window: one document at a time with a running answer." },
        { image: "10-home-how-it-works", caption: "How it works: the three-step overview further down the page." },
      ],
      { maxH: 320 },
    ),
  ];
}

function playgroundChapter() {
  return [
    h1("4. Ask a question in the Playground"),
    p("The Playground runs a single question through several strategies at once. This example uses the built-in sample documents and GLM 5.3 Flash."),
    h2("4.1 Load documents"),
    lead("Paste text, upload files, or press Load sample. RAG Atlas splits the documents into passages and previews how they were cut."),
    ...figure("14-playground-sample-corpus", "The sample documents loaded, with the passage preview."),
    h2("4.2 Choose strategies and a model"),
    lead(
      "Tick the strategies to compare, then pick a model from the dropdown. The list shows each model's lab and price, marks the model used in the paper, and flags open-weights models. Custom model slug accepts any model listed on OpenRouter.",
    ),
    ...grid([
      { image: "16-model-dropdown", caption: "The model dropdown." },
      { image: "17-model-custom-slug", caption: "Entering a custom model id." },
    ]),
    lead(
      "The Reasoning setting controls how much the model thinks before answering. Lowest available is the default: it turns thinking off when a model allows it and otherwise uses the lowest effort, while always leaving the model enough room to finish.",
    ),
    ...figure("18-model-glm-selected", "GLM 5.3 Flash selected. The note explains that this model always reasons."),
    h2("4.3 Ask and run"),
    lead("Type a question or pick a suggested one; the tag next to the Run button estimates the cost. Each strategy then streams its progress."),
    ...figure("20-playground-running", "A run in progress."),
    h2("4.4 Read the answers"),
    lead("Every card shows the answer, its cost, time, and token counts, and the pipeline steps behind it. Open retrieved chunks to see exactly what the model was given."),
    ...figure("21-playground-results", "Answers from three strategies on GLM 5.3 Flash."),
    ...figure("22-playground-retrieved-chunks", "A card with its retrieved passages expanded.", { maxH: 400 }),
  ];
}

function compareEvaluateRecommend() {
  return [
    h1("5. Compare, evaluate, and get recommendations"),
    h2("5.1 Compare"),
    lead("Compare lays out the most recent Playground run: the answers side by side with a note on where they agree, automatic observations, cost and time charts, the steps each pipeline took, and the passages each one retrieved."),
    ...figure("g-compare-answers", "Answers from each strategy, side by side."),
    ...figure("g-compare-insights", "Automatic observations about the run."),
    ...figure("g-compare-cost-latency", "Cost and response time for each strategy."),
    ...figure("g-compare-pipeline-diff", "The steps each pipeline took."),
    h2("5.2 Evaluate your own questions"),
    lead(
      "Evaluate grades strategies on questions with known answers. Load documents, add questions with their gold answers (or load the sample set), choose strategies, then choose the model, temperature, and number of runs. Repeating a run with different seeds shows how stable each score is.",
    ),
    ...figure("g-eval-questions", "A question set with gold answers and question types.", { maxH: 400 }),
    ...figure("25-evaluate-model-and-runs", "Model, temperature, and number of runs."),
    h2("5.3 Get a recommendation"),
    lead("Recommend asks for a use case and a few constraints, then ranks strategies with reasons drawn from the research. Treat it as a starting point and confirm it with Evaluate."),
    ...figure("g-recommend-questions", "A few questions about the use case."),
    ...figure("g-recommend-result", "The ranked recommendation.", { maxH: 400 }),
  ];
}

function replayChapter() {
  return [
    h1("6. Test a new model with Replay"),
    p(
      "Replay reruns the paper's case study on any model: four documents and 34 questions covering simple facts, planted details, questions that need two documents, misleading passages, and questions with no answer in the documents. The worked example below tests GLM 5.3 Flash.",
    ),
    h2("6.1 Set up the run"),
    lead("Pick the model, then press Use the paper's settings (temperature 0.3 and three runs) so the numbers are comparable with the published ones. Select the strategies and check the cost estimate before starting."),
    ...figure("30-replay-page", "The Replay page."),
    ...figure("31-replay-model-settings", "GLM 5.3 Flash with the paper's settings."),
    ...figure("33-replay-strategies-and-estimate", "All seven strategies selected, with the estimated cost and number of model calls."),
    h2("6.2 Follow the progress"),
    lead("Each bar counts graded answers for one strategy across all three runs, with the run number and the cost so far. The full GLM 5.3 Flash replay took about 33 minutes."),
    ...figure("34-replay-progress-01", "Shortly after the start."),
    ...figure("34-replay-progress-05", "About halfway: two strategies finished."),
    ...figure("34-replay-progress-10", "The finished replay."),
    h2("6.3 The saved test"),
    p("When a run finishes it is saved automatically, and a summary card appears above the results listing the model, settings, total cost, number of model calls, and time taken. Section 8.1 shows this card for the GLM 5.3 Flash test."),
    h2("6.4 Compare with the paper"),
    lead(
      "Replay sets the new results against the paper's Gemini 3 Flash results: the average gap in F1, how similarly the strategies rank, how many strategies fall inside the paper's confidence intervals, and per-strategy F1 and cost. Chapter 9 explains why Full-Context looks weak in this first run.",
    ),
    ...figure("41-result-glm-vs-paper", "GLM 5.3 Flash against the paper's Gemini 3 Flash results."),
  ];
}

function readingResultsChapter() {
  return [
    h1("7. Read the results"),
    p(
      "Evaluate and Replay share the same results view. F1 gives partial credit for answers that are close to the gold answer; EM (exact match) counts only exact answers. A switch at the top redraws every chart with either measure.",
    ),
    h2("7.1 Leaderboard"),
    lead("Strategies ranked by F1, with the spread between runs, 95% confidence intervals, cost per run, and median response time."),
    ...figure("42-result-leaderboard", "The leaderboard for GLM 5.3 Flash."),
    h2("7.2 Charts"),
    ...grid(
      [
        { image: "43-result-f1-confidence-intervals", caption: "F1 with 95% confidence intervals. Overlapping bars may be noise." },
        { image: "44-result-per-probe-radar", caption: "F1 for each kind of question." },
        { image: "45-result-head-to-head-wins", caption: "How often each strategy is right where another is wrong." },
        { image: "46-result-significance", caption: "Statistical significance of each pairwise difference." },
      ],
      { maxH: 290 },
    ),
    h2("7.3 Refusals and individual questions"),
    lead("Refusal honesty shows how often each strategy correctly declines questions whose answer is not in the documents. The question explorer lists every question with each strategy's result; click a row to read the answers from each run."),
    ...figure("47-result-refusal-honesty", "Refusal honesty."),
    ...grid(
      [
        { image: "48-result-question-explorer", part: 1, caption: "The question explorer." },
        { image: "49-result-question-expanded", part: 1, caption: "A question expanded to show every answer." },
      ],
      { maxH: 380 },
    ),
  ];
}

function savedTestsChapter() {
  return [
    h1("8. Reopen saved tests, History, and Profiler"),
    h2("8.1 Load the results from a previous test"),
    lead(
      "Every finished evaluation or replay is saved. The Load the results from a previous test button on Replay and Evaluate lists them and reopens one exactly as it was produced, without running or spending anything. The paper's own Gemini 3 Flash results are included, so they can be opened next to any new test.",
    ),
    ...figure(
      "g-previous-tests",
      "The saved tests: the GLM 5.3 Flash replay, its two Full-Context follow-ups, and the paper's Gemini 3 Flash results.",
      { maxH: 400 },
    ),
    ...figure("g-loaded-glm-details", "The GLM 5.3 Flash test reopened, with its model, settings, cost, and run time. Its results match the ones shown when the run finished."),
    h2("8.2 History and Profiler"),
    lead(
      "History keeps runs, evaluations, and saved configurations in the browser, with search, export, and import. The Profiler shows cost, quality, and speed for an evaluation and can re-price it at any other model's rates.",
    ),
    ...figure("g-history", "History, with the GLM 5.3 Flash replay listed.", { maxH: 380 }),
    ...figure("g-profiler-price", "Profiler price sliders, starting from the model's list price."),
    ...figure("g-profiler-pareto", "Cost against quality for each strategy."),
    ...figure("g-profiler-costs", "Total cost and cost per correct answer."),
  ];
}

function resultsChapter({ glm, paper, followUps }) {
  if (!glm || !paper) return [];
  const g = glm.data;
  const gh = data.headlineBy(glm);
  const ph = data.headlineBy(paper);
  const order = [...g.results.headline].sort((a, b) => b.f1 - a.f1).map((h) => h.approach);
  const delta = (a) => `${gh[a].f1 - ph[a].f1 >= 0 ? "+" : ""}${((gh[a].f1 - ph[a].f1) * 100).toFixed(1)}`;
  const ragGap = Math.max(...data.RAG_APPROACHES.map((a) => Math.abs(gh[a].f1 - ph[a].f1))) * 100;
  const costRatio = order.reduce((s, a) => s + ph[a].cost_usd, 0) / order.reduce((s, a) => s + gh[a].cost_usd, 0);
  const high = followUps.find((f) => f.data.config.reasoning_effort_sent === "high");
  const check = followUps.find((f) => f.data.config.reasoning_effort_sent === "low" && f.data.config.max_tokens_sent >= 2048);
  const fc = (r) => data.headlineBy(r).full_context;
  const fcRuntime = (r) => r.data.runtime.per_approach.full_context;
  const note = (text) => p([run(text, { size: 16, color: MUTED, italics: true })], { spacing: { before: 80, after: 200 } });

  const out = [
    h1("9. Worked example: GLM 5.3 Flash results"),
    h2("9.1 What was run"),
    bullet(`Model: ${g.model.label}, an open-weights model, called through OpenRouter.`),
    bullet(`Data: the paper's case study, ${g.dataset.n_docs} documents and ${g.dataset.n_questions} questions with known answers.`),
    bullet(`Settings: temperature ${g.config.temperature}, ${g.config.repeats} runs, all seven strategies. These match the paper, which used Gemini 3 Flash.`),
    bullet(`Reasoning: GLM 5.3 Flash always reasons; this run used low effort with a ${g.config.max_tokens_sent}-token limit.`),
    bullet(`Run: ${(g.runtime.wall_s / 60).toFixed(0)} minutes, ${g.runtime.llm_calls.toLocaleString("en-US")} model calls, ${data.usd(g.runtime.total_cost_usd)} in total.`),
    h2("9.2 GLM 5.3 Flash compared with the paper"),
    table(
      ["Strategy", "GLM 5.3 Flash F1", "Gemini 3 Flash F1", "Δ F1", "GLM EM", "Paper EM", "GLM $/run", "Paper $/run"],
      order.map((a) => [
        data.LABELS[a],
        `${data.pct(gh[a].f1)}${data.pts(gh[a].f1_seed_std)}`,
        `${data.pct(ph[a].f1)}${data.pts(ph[a].f1_seed_std)}`,
        delta(a),
        data.pct(gh[a].em),
        data.pct(ph[a].em),
        data.usd(gh[a].cost_usd),
        data.usd(ph[a].cost_usd),
      ]),
      [1780, 1340, 1340, 760, 980, 980, 1090, 1090],
      { align: ["left", "right", "right", "right", "right", "right", "right", "right"], size: 17 },
    ),
    note(
      "F1 and EM are means of three runs, ± the spread between runs. Gemini 3 Flash figures are the paper's published results. GLM 5.3 Flash costs are what OpenRouter billed; the paper's costs were estimated from token counts, so compare them only roughly.",
    ),
    h2("9.3 What the numbers show"),
    bullet(`The four retrieval strategies stayed within ${ragGap.toFixed(1)} F1 points of the paper, and GLM 5.3 Flash was slightly ahead on Reranker, Naive RAG, and Hybrid RAG.`),
    bullet(`A full GLM 5.3 Flash run cost roughly ${costRatio.toFixed(0)} times less than the paper's estimate for Gemini 3 Flash.`),
    bullet(`Recursive Summary differed the most between the two models (${data.pct(gh.recursive_summary.f1)} against ${data.pct(ph.recursive_summary.f1)}): how well summaries keep exact details depends on the model.`),
    bullet(`Full-Context scored only ${data.pct(gh.full_context.f1)} in this run. Section 9.4 shows why.`),
  ];

  if (high) {
    const row = (label, r, f) => [
      label,
      `${r.data.config.reasoning_effort_sent}, ${r.data.config.max_tokens_sent.toLocaleString("en-US")}`,
      `${data.pct(f.f1)}${r.data.config.repeats > 1 ? data.pts(f.f1_seed_std) : ""}`,
      data.pct(f.em),
      fcRuntime(r).truncation_retries,
      Math.round(fcRuntime(r).reasoning_tokens / fcRuntime(r).llm_calls),
      data.usd(f.cost_usd),
    ];
    const rows = [row("Full replay", glm, gh.full_context), row("Follow-up, 3 runs", high, fc(high))];
    if (check) rows.push(row(`After the fix, ${check.data.config.repeats} run`, check, fc(check)));
    out.push(
      h2("9.4 Full-Context needs room to think"),
      p(
        "A reasoning model shares its token limit between thinking and answering. At low effort only a fifth of a 640-token limit was left for thinking, which was not enough for the 8,000-token Full-Context prompt: answers were cut off, or the model reported that facts in the documents were missing. Rerunning Full-Context with more room gave a very different picture.",
      ),
      table(
        ["Full-Context run", "Effort, token limit", "F1", "EM", "Cut-off retries", "Thinking tokens per answer", "Cost per run"],
        rows,
        [2000, 1500, 1260, 900, 1100, 1500, 1100],
        { align: ["left", "left", "right", "right", "right", "right", "right"], size: 17 },
      ),
      gap(160),
      p(
        `With room to think, Full-Context reached ${data.pct(fc(high).f1)} F1, the best result on either model, and it cost less per run because nothing had to be retried. The other six strategies barely used any thinking and were unaffected. RAG Atlas now always leaves reasoning models at least 1,024 tokens to think with${check ? `; a check run with the default setting scored ${data.pct(fc(check).f1)}` : ""}.`,
      ),
      h2("9.5 Takeaway"),
      p(
        "With enough room to think, GLM 5.3 Flash and Gemini 3 Flash agree on the essentials: Full-Context leads and the retrieval strategies follow closely, at a fraction of the cost on GLM 5.3 Flash. The strategy you choose, and its settings, change the results far more than switching between these two models. Replay makes it quick to check this for any model before you commit to one.",
      ),
    );
  }
  return out;
}

function tipsChapter() {
  return [
    h1("10. Tips and troubleshooting"),
    bullet([bold("Check the estimate first. "), run("Replay and Evaluate show the expected cost and number of model calls before anything runs. Recorded costs are what OpenRouter reports for each call.")]),
    bullet([bold("Use several runs for decisions. "), run("One run is fine for exploring; three runs show how stable each score is.")]),
    bullet([bold("Reasoning models. "), run("Keep Lowest available unless answers look cut off. For long prompts such as Full-Context, a higher effort can help.")]),
    bullet([bold("Custom models. "), run("Choose Custom model slug and paste any model id from openrouter.ai/models. RAG Atlas checks the id before using it.")]),
    bullet([bold("Saved tests. "), run("Load the results from a previous test reopens any finished evaluation or replay without running it again.")]),
    bullet([bold("Progress stays at zero. "), run("Restart both servers after updating the app.")]),
    bullet([bold("Development builds. "), run("Do not run npm run build while npm run dev is running; the two share a build folder.")]),
  ];
}

// --- document -----------------------------------------------------------------------

async function main() {
  const entries = data.readLog();
  const date = entries[0] ? new Date(entries[0].at).toLocaleDateString("en-US", { year: "numeric", month: "long" }) : "";

  const doc = new Document({
    creator: "RAG Atlas",
    title: "RAG Atlas User Guide",
    description: "How to use RAG Atlas, with a worked example on GLM 5.3 Flash",
    features: { updateFields: true },
    styles: {
      default: { document: { run: { font: "Arial", size: 21, color: INK } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Arial", size: 38, bold: true, color: INK }, paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Arial", size: 26, bold: true, color: ACCENT }, paragraph: { spacing: { before: 300, after: 120 }, outlineLevel: 1 } },
      ],
    },
    numbering: {
      config: [
        { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
        { reference: "steps", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] },
      ],
    },
    sections: [
      {
        properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [run("RAG Atlas User Guide   ·   Page ", { size: 16, color: FAINT }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: FAINT })],
              }),
            ],
          }),
        },
        children: [
          ...titlePage(date),
          ...introduction(),
          ...gettingStarted(),
          ...exploreChapter(),
          ...playgroundChapter(),
          ...compareEvaluateRecommend(),
          ...replayChapter(),
          ...readingResultsChapter(),
          ...savedTestsChapter(),
          ...resultsChapter(data.readResults()),
          ...tipsChapter(),
        ],
      },
    ],
  });

  fs.writeFileSync(OUT, await Packer.toBuffer(doc));
  console.log(`Wrote ${OUT} (${figureNo} figures)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
