// Shared helpers for the RAG Atlas walkthrough captures (Playwright driving the installed Chrome).
// Every screenshot is appended to ../capture-log.jsonl with its absolute path and a caption.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const BASE = process.env.RAG_ATLAS_URL || "http://localhost:3000";
const ROOT = path.resolve(__dirname, "..");
const SHOTS = path.join(ROOT, "screenshots");
const LOG = path.join(ROOT, "capture-log.jsonl");
const STATE = path.join(__dirname, ".browser-state.json");
const CARD = 'xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " p-5 ")][1]';

fs.mkdirSync(SHOTS, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch({ fresh = false } = {}) {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    storageState: !fresh && fs.existsSync(STATE) ? STATE : undefined,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  return { browser, context, page };
}

async function saveState(context) {
  await context.storageState({ path: STATE });
}

function log(entry) {
  const line = { at: new Date().toISOString(), ...entry };
  fs.appendFileSync(LOG, JSON.stringify(line) + "\n");
  console.log(`[${line.at}] ${entry.step ?? ""} ${entry.file ?? entry.note ?? ""}`);
}

/** Screenshot a page (viewport or full page) or one element, and log it. */
async function shot(target, name, { step, caption, fullPage = false, extra } = {}) {
  const file = path.join(SHOTS, `${name}.png`);
  const isPage = typeof target.goto === "function";
  if (isPage) await target.screenshot({ path: file, fullPage });
  else await target.screenshot({ path: file });
  const page = isPage ? target : target.page();
  log({ step, name, file, caption, url: page.url(), ...(extra || {}) });
  return file;
}

/** The card that contains a label (eyebrow by default, or any selector such as "h2"). */
function panel(page, text, selector = "p.eyebrow") {
  return page.locator(selector, { hasText: text }).first().locator(CARD);
}

async function dismissTour(page) {
  const skip = page.getByRole("button", { name: "Skip" });
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
    await sleep(500);
  }
}

async function selectModel(page, label) {
  const trigger = page.getByRole("button", { name: "Choose a model" }).first();
  if ((await trigger.innerText()).includes(label)) return;
  await trigger.click();
  await page.getByRole("option", { name: new RegExp(label.replace(/\./g, "\\.")) }).first().click();
  await sleep(500);
}

module.exports = { BASE, ROOT, SHOTS, LOG, STATE, sleep, launch, saveState, log, shot, panel, dismissTour, selectModel };
