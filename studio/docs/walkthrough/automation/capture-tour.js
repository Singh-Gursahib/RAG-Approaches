// Part 1: the app before the GLM 5.3 Flash test. Home, simulations, glossary, key dialog,
// model picker, one small Playground run on GLM 5.3 Flash, Compare, Evaluate, Recommend, History.
const { BASE, launch, saveState, shot, panel, sleep, dismissTour, selectModel, log } = require("./common");

const MODEL = "GLM 5.3 Flash";

(async () => {
  const { browser, context, page } = await launch({ fresh: true });
  try {
    // --- Home + onboarding ---------------------------------------------------
    await page.goto(BASE + "/");
    await page.getByRole("button", { name: "Skip" }).waitFor({ timeout: 20_000 }).catch(() => {});
    await sleep(1200);
    await shot(page, "01-onboarding-tour", {
      step: "Onboarding tour",
      caption: "On the first visit a short tour explains the five steps: add a key, load a corpus, pick strategies, run, and compare.",
    });
    await dismissTour(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(800);
    await shot(page, "02-home-hero", {
      step: "Home page",
      caption: "The home page. The header holds the navigation, the backend status, the help menu, and the key status pill.",
    });

    // --- Strategy simulations ------------------------------------------------
    const sims = page.locator("section", { hasText: "Seven ways to find an answer" }).first();
    await sims.scrollIntoViewIfNeeded();
    const auto = sims.getByRole("button", { name: /Auto-playing/ });
    if (await auto.isVisible().catch(() => false)) await auto.click();
    const rail = sims.locator("button[aria-current]");
    const count = await rail.count();
    for (let i = 0; i < count; i++) {
      const btn = rail.nth(i);
      const label = (await btn.innerText()).trim();
      await btn.click();
      await sleep(4000);
      const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      await shot(sims, `${String(3 + i).padStart(2, "0")}-simulation-${slug}`, {
        step: `Simulation: ${label}`,
        caption: `The animated explainer for ${label}: how it moves a question through the corpus, what it is best for, where it struggles, and its cost.`,
      });
    }

    const how = page.locator("section", { hasText: "How it works" }).first();
    await how.scrollIntoViewIfNeeded();
    await sleep(800);
    await shot(how, "10-home-how-it-works", {
      step: "How it works",
      caption: "The home page's summary of the workflow.",
    });

    // --- Glossary ------------------------------------------------------------
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole("button", { name: "Help and glossary" }).click();
    await page.getByRole("dialog").waitFor();
    await sleep(700);
    await shot(page.getByRole("dialog"), "11-glossary", {
      step: "Glossary",
      caption: "The ? button in the header opens a glossary of the terms used across the app.",
    });
    await page.getByRole("dialog").getByRole("button", { name: "Done" }).click();
    await sleep(500);

    // --- OpenRouter key dialog (nothing is typed) ----------------------------
    await page.getByRole("button", { name: /Server key|Key connected|Add your key/ }).first().click();
    await page.getByRole("dialog").waitFor();
    await sleep(700);
    await shot(page.getByRole("dialog"), "12-openrouter-key-dialog", {
      step: "OpenRouter API key",
      caption:
        "The key dialog. Paste an OpenRouter key (stored only in this browser tab) or rely on a server key from the repo's .env. It also explains that requests carry no app attribution.",
    });
    await page.keyboard.press("Escape");
    await sleep(500);

    // --- Playground ------------------------------------------------------------
    await page.goto(BASE + "/playground");
    await dismissTour(page);
    await sleep(1500);
    await shot(page, "13-playground-start", {
      step: "Playground",
      caption: "The Playground is a three-step flow: corpus, strategies and model, then a question.",
    });

    await page.getByRole("button", { name: "Load sample" }).click();
    await sleep(3000);
    await shot(panel(page, "Your corpus", "h2"), "14-playground-sample-corpus", {
      step: "Load a corpus",
      caption: "Load sample fills in a small synthetic corpus and shows how it is chunked.",
    });

    const step2 = panel(page, "Strategies to compare", "h2");
    await step2.scrollIntoViewIfNeeded();
    await sleep(600);
    await shot(step2, "15-playground-strategies-and-model", {
      step: "Pick strategies and a model",
      caption: "Pick strategies, then a model. Gemini 3 Flash, the paper's model, is the default.",
    });

    // Put the picker near the top of the window so the whole open list is visible.
    await page.getByRole("button", { name: "Choose a model" }).evaluate((el) => el.scrollIntoView({ block: "start" }));
    await page.evaluate(() => window.scrollBy(0, -140));
    await sleep(400);
    await page.getByRole("button", { name: "Choose a model" }).click();
    await sleep(600);
    await shot(page, "16-model-dropdown", {
      step: "Model dropdown",
      caption:
        "The model dropdown lists the curated OpenRouter models with their lab, live price, and badges for the paper's model and open-weights models, plus a custom slug option.",
    });

    await page.getByRole("option", { name: /Custom model slug/ }).click();
    await sleep(500);
    await shot(step2, "17-model-custom-slug", {
      step: "Custom model slug",
      caption: "Custom model slug accepts any OpenRouter model id. Use this model checks it against OpenRouter's model list first.",
    });

    await selectModel(page, MODEL);
    await sleep(800);
    await shot(step2, "18-model-glm-selected", {
      step: "GLM 5.3 Flash selected",
      caption:
        "GLM 5.3 Flash selected. With reasoning on Lowest available, the note explains this model always reasons, so the app requests low effort.",
    });

    await page.getByRole("button", { name: /What year was Veridian/ }).click();
    const step3 = panel(page, "Your question", "h2");
    await step3.scrollIntoViewIfNeeded();
    await sleep(800);
    await shot(step3, "19-playground-question", {
      step: "Ask a question",
      caption: "Type a question or pick a suggested one. The tag shows a pre-flight cost estimate.",
    });

    await page.getByRole("button", { name: /^Run \d+ strateg/ }).click();
    await sleep(3000);
    const results = page.locator('section[aria-live="polite"]');
    await results.scrollIntoViewIfNeeded();
    await shot(page, "20-playground-running", {
      step: "Run in progress",
      caption: "Each strategy streams its pipeline live: indexing, retrieval, and generation, with a running cost.",
    });
    log({ step: "Playground run", note: `Waiting for ${MODEL} answers` });
    await page.getByRole("button", { name: /^Run \d+ strateg/ }).waitFor({ timeout: 15 * 60_000 });
    await sleep(1500);
    await shot(results, "21-playground-results", {
      step: "Playground answers",
      caption: "Answers from each strategy on GLM 5.3 Flash, with the pipeline trace, tokens, latency, and cost of every step.",
    });
    const chunks = page.getByRole("button", { name: /retrieved chunk/ }).first();
    if (await chunks.isVisible().catch(() => false)) {
      await chunks.click();
      await sleep(700);
      await shot(results, "22-playground-retrieved-chunks", {
        step: "Retrieved chunks",
        caption: "Open a card's retrieved chunks to see exactly what the model was given, with retrieval scores.",
      });
    }

    // --- Compare ---------------------------------------------------------------
    await page.goto(BASE + "/compare");
    await sleep(3500);
    await shot(page, "23-compare", {
      step: "Compare",
      fullPage: true,
      caption: "Compare lays out the last run side by side: answers, insights, cost, latency, tokens, a cost × latency chart, the pipeline diff, and the retrieval inspector.",
    });

    // --- Evaluate --------------------------------------------------------------
    await page.goto(BASE + "/evaluate");
    await sleep(1500);
    await page.getByRole("button", { name: "Load sample", exact: true }).click();
    await sleep(2500);
    await page.getByRole("button", { name: "Load sample set" }).click();
    await sleep(2000);
    await shot(page, "24-evaluate-setup", {
      step: "Evaluate",
      fullPage: true,
      caption:
        "Evaluate grades strategies on your own questions with gold answers: corpus, question set, strategies, then model, temperature, and number of runs. Load the results from a previous test sits at the top.",
    });
    const step4 = panel(page, "Model", "h2");
    await step4.scrollIntoViewIfNeeded();
    await sleep(600);
    await shot(step4, "25-evaluate-model-and-runs", {
      step: "Evaluate: model and runs",
      caption: "Every strategy uses the same model. Runs repeats the whole evaluation with a different seed each time.",
    });

    // --- Recommend -------------------------------------------------------------
    await page.goto(BASE + "/recommend");
    await sleep(1500);
    await panel(page, "1 · Pick your use case").locator("button").first().click();
    await sleep(800);
    const questions = panel(page, "2 · A few questions");
    const groups = questions.locator("div.flex.flex-wrap.gap-2");
    const nGroups = await groups.count();
    for (let i = 0; i < nGroups; i++) {
      await groups.nth(i).locator("button").first().click();
      await sleep(250);
    }
    await sleep(1500);
    await shot(page, "26-recommend", {
      step: "Recommend",
      fullPage: true,
      caption: "Recommend asks for a use case and a few constraints, then ranks strategies with reasons drawn from the research.",
    });

    // --- History ---------------------------------------------------------------
    await page.goto(BASE + "/history");
    await sleep(2000);
    await shot(page, "27-history", {
      step: "History",
      fullPage: true,
      caption: "History keeps runs, evaluations, and saved configurations in this browser, with search, export, and import.",
    });

    await saveState(context);
    log({ step: "Part 1 complete", note: "capture-tour.js finished" });
  } catch (err) {
    await page.screenshot({ path: require("path").join(__dirname, "..", "screenshots", "99-tour-error.png") }).catch(() => {});
    log({ step: "ERROR", note: String(err && err.stack ? err.stack : err) });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
