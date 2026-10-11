// A signed-in headless Chrome page for the e2e suites. Uses the system Chrome
// (GitHub's Ubuntu runners ship one), so CI downloads no browser.

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { sessionCookie } from "./server.mjs";

const ARTIFACTS = path.resolve("tests/e2e/.artifacts");

/**
 * @param {{ base: string }} app from startApp
 * @param {{ userId?: number, onboardingDone?: boolean }} [opts]
 */
export async function openBrowser(app, { userId = 1, onboardingDone = true } = {}) {
  const browser = await chromium.launch({ channel: process.env.E2E_CHROME_CHANNEL || "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([{ name: "jbs_session", value: sessionCookie(userId).split("=")[1], url: app.base }]);
  if (onboardingDone) await context.addInitScript(() => localStorage.setItem("has_completed_onboarding_wizard_v1", "true"));
  const page = await context.newPage();

  /** Console errors and uncaught exceptions since the last `errors.length = 0`. */
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(e.message));

  /** Run a step; on failure, save a screenshot under tests/e2e/.artifacts before rethrowing. */
  async function step(name, fn) {
    try {
      return await fn();
    } catch (err) {
      fs.mkdirSync(ARTIFACTS, { recursive: true });
      await page.screenshot({ path: path.join(ARTIFACTS, `${name.replace(/\W+/g, "-")}.png`), fullPage: true }).catch(() => {});
      throw err;
    }
  }

  return { browser, page, errors, step, close: () => browser.close() };
}

/** Errors that mean the page itself is broken, as opposed to an expected failed API call. */
export function pageErrors(errors) {
  return errors.filter((e) => !/Failed to load resource|status of (401|404|409|429|502|503)/.test(e));
}
