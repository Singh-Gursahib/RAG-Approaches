// Captures the reopened GLM 5.3 Flash test card for the Word guide, with the saved file's path
// hidden (the guide is shared on its own, without the results folder). No model calls.
const { BASE, launch, shot, panel, sleep, dismissTour, log } = require("./common");

(async () => {
  const { browser, page } = await launch();
  try {
    await page.goto(BASE + "/replay");
    await dismissTour(page);
    await page.getByText("The bundled case study").waitFor();
    await sleep(1500);
    await page.getByRole("button", { name: "Load the results from a previous test" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByText("GLM 5.3 Flash · paper case study · 3 runs").first().waitFor();
    await sleep(800);
    const hiddenIntro = await page.evaluate(() => {
      let n = 0;
      for (const el of document.querySelectorAll("[role=dialog] p")) {
        if (el.textContent.includes("studio/results/")) {
          el.style.display = "none";
          n += 1;
        }
      }
      return n;
    });
    if (!hiddenIntro) throw new Error("Saved-tests folder sentence not found");
    await shot(dialog, "g-previous-tests", { step: "Previous tests list (folder sentence hidden)" });
    await dialog.getByRole("button", { name: /GLM 5\.3 Flash · paper case study · 3 runs(?! ·)/ }).first().click();
    await page.getByText("Loaded from a previous test").waitFor();
    await sleep(2500);
    const hidden = await page.evaluate(() => {
      let n = 0;
      for (const el of document.querySelectorAll("span")) {
        if (el.textContent.startsWith("studio/results/")) {
          el.closest("p").style.display = "none";
          n += 1;
        }
      }
      return n;
    });
    if (!hidden) throw new Error("Saved-file path line not found");
    await shot(panel(page, "Loaded from a previous test"), "g-loaded-glm-details", { step: "Loaded GLM 5.3 Flash test (path hidden)" });
    log({ step: "Guide loaded-card capture complete", note: `hid ${hidden} path line(s)` });
  } catch (err) {
    log({ step: "ERROR", note: String(err && err.stack ? err.stack : err) });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
