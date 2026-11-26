// The app in a real browser: pages render without errors or hydration
// mismatches, and the main flows on the jobs list, a job and the profile work
// end to end. Run `pnpm build` first; uses the system Chrome.

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { startApp } from "../helpers/server.mjs";
import { openBrowser, pageErrors } from "../helpers/browser.mjs";

let app;
let ui;
let jobId;

const job = async (id) => (await app.req("GET", `/api/jobs/${id}`)).data?.job;
const hydrationErrors = (errors) => errors.filter((e) => /hydrat|did not match|server rendered/i.test(e));

before(async () => {
  app = await startApp();
  await app.addUsers({ id: 1, email: "a@test", name: "Dev User" });
  await app.req("POST", "/api/resumes", { body: { name: "Main resume", content: "Jane Doe\nEngineer\nTypeScript, SQL, design systems", is_default: true } });
  jobId = (await app.req("POST", "/api/jobs", {
    body: { company: "Acme", title: "Engineer", url: "https://acme.test/1", status: "applied", posting_text: "Build things with TypeScript and SQL. 5+ years." },
  })).data.job.id;
  await app.req("POST", "/api/jobs", { body: { company: "Zeta", title: "Designer", url: "https://zeta.test/1" } });
  ui = await openBrowser(app);
});

after(async () => {
  await ui?.close();
  await app?.stop();
});

describe("pages", () => {
  it("/jobs, a job and /profile render without errors", async () => {
    for (const path of ["/jobs", `/jobs/${jobId}`, "/profile"]) {
      ui.errors.length = 0;
      await ui.step(`render ${path}`, async () => {
        await ui.page.goto(app.base + path, { waitUntil: "networkidle" });
        await ui.page.waitForTimeout(500);
        assert.deepEqual(pageErrors(ui.errors), [], path);
      });
    }
  });

  it("onboarding opens on a first visit, without a hydration mismatch, and stays dismissed", async () => {
    const fresh = await openBrowser(app, { onboardingDone: false });
    try {
      await fresh.step("onboarding", async () => {
        await fresh.page.goto(`${app.base}/jobs?view=tracker`, { waitUntil: "networkidle" });
        // getByRole skips the app's other dialogs, which sit in the page closed.
        const dialog = fresh.page.getByRole("dialog");
        await dialog.waitFor();
        assert.deepEqual(hydrationErrors(fresh.errors), []);
        await dialog.getByRole("button", { name: "Skip tour" }).click();
        await dialog.waitFor({ state: "hidden" });
        await fresh.page.reload({ waitUntil: "networkidle" });
        await fresh.page.waitForTimeout(500);
        assert.equal(await dialog.count(), 0, "stays dismissed after a reload");
      });
    } finally {
      await fresh.close();
    }
  });
});

describe("jobs list", () => {
  it("a chosen sort survives a reload, without a hydration mismatch", async () => {
    await ui.step("sort", async () => {
      const { page } = ui;
      await page.goto(`${app.base}/jobs?view=tracker`, { waitUntil: "networkidle" });
      await page.locator("th").filter({ hasText: /^Company/ }).locator("button").first().click();
      await page.waitForTimeout(500);
      ui.errors.length = 0;
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(800);
      assert.equal(await page.evaluate(() => sessionStorage.getItem("jobsSortKey")), "company");
      assert.match(await page.locator("table tbody tr").first().innerText(), /Acme/);
      assert.deepEqual(hydrationErrors(ui.errors), []);
    });
  });

  it("an auto-closed job can be confirmed from the banner", async () => {
    const closed = (await app.req("POST", "/api/jobs", { body: { company: "Initech", title: "PM", url: "https://initech.test/1", status: "applied" } })).data.job.id;
    await app.db.execute({ sql: "UPDATE jobs SET status = 'closed', previous_status = 'applied', auto_closed = 1 WHERE id = ?", args: [closed] });
    await ui.step("confirm auto-closed", async () => {
      const { page } = ui;
      await page.goto(`${app.base}/jobs?view=tracker`, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "This looks correct. Save." }).click();
      await page.getByText(/Saved — 1 job stays closed/).waitFor();
      assert.equal((await app.req("GET", "/api/jobs/check-status")).data.restorableCount, 0);
    });
  });
});

describe("a job", () => {
  it("changing the status saves it", async () => {
    await ui.step("status", async () => {
      const { page } = ui;
      await page.goto(`${app.base}/jobs/${jobId}`, { waitUntil: "networkidle" });
      await page.getByRole("combobox", { name: "Status", exact: true }).click();
      await page.getByRole("option", { name: "Onsite" }).click();
      await page.waitForTimeout(800);
      assert.equal((await job(jobId)).status, "onsite");
    });
  });

  it("a rule-based fitness check runs and is saved", async () => {
    await ui.step("analyze", async () => {
      const { page } = ui;
      await page.goto(`${app.base}/jobs/${jobId}`, { waitUntil: "networkidle" });
      const withAi = page.getByRole("checkbox", { name: /with AI/i });
      if (await withAi.isChecked()) await withAi.uncheck();
      await page.getByRole("button", { name: "Analyze" }).first().click();
      for (let i = 0; i < 20 && (await job(jobId)).fitness_score == null; i++) await page.waitForTimeout(250);
      assert.equal(typeof (await job(jobId)).fitness_score, "number");
    });
  });

  it("delete asks first: cancel keeps the job, confirm removes it", async () => {
    const doomed = (await app.req("POST", "/api/jobs", { body: { company: "Doomed", title: "Temp" } })).data.job.id;
    await ui.step("delete", async () => {
      const { page } = ui;
      await page.goto(`${app.base}/jobs/${doomed}`, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Delete", exact: true }).first().click();
      const dialog = page.getByRole("alertdialog");
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await dialog.waitFor({ state: "hidden" });
      assert.ok(await job(doomed), "cancel keeps it");
      await page.getByRole("button", { name: "Delete", exact: true }).first().click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
      await page.waitForURL(/\/jobs$/);
      assert.equal((await app.req("GET", `/api/jobs/${doomed}`)).status, 404);
    });
  });
});

describe("profile", () => {
  it("application fields save and come back after a reload", async () => {
    await ui.step("profile fields", async () => {
      const { page } = ui;
      await page.goto(`${app.base}/profile`, { waitUntil: "networkidle" });
      await page.getByLabel("First name").fill("Jane");
      await page.getByLabel("LinkedIn URL").fill("linkedin.com/in/jane");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await page.getByText("Saved!").waitFor();
      await page.reload({ waitUntil: "networkidle" });
      assert.equal(await page.getByLabel("First name").inputValue(), "Jane");
      assert.equal(await page.getByLabel("LinkedIn URL").inputValue(), "linkedin.com/in/jane");
    });
  });
});

describe("theme, tooltips and keyboard", () => {
  it("dark mode applies at once, survives a reload without a hydration mismatch, and back to system", async () => {
    await ui.step("theme", async () => {
      const { page } = ui;
      const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
      await page.goto(`${app.base}/profile`, { waitUntil: "networkidle" });
      await page.getByRole("group", { name: "Theme" }).getByRole("button", { name: "Dark" }).click();
      assert.equal(await theme(), "dark");
      ui.errors.length = 0;
      await page.reload({ waitUntil: "networkidle" });
      assert.equal(await theme(), "dark", "set before paint from the saved choice");
      assert.deepEqual(hydrationErrors(ui.errors), []);
      await page.getByRole("group", { name: "Theme" }).getByRole("button", { name: "System" }).click();
      assert.equal(await page.evaluate(() => localStorage.getItem("theme")), null);
      assert.equal(await theme(), "light", "headless Chrome reports a light system theme");
    });
  });

  it("an icon button shows a styled tooltip on hover", async () => {
    await ui.step("tooltip", async () => {
      const { page } = ui;
      await page.goto(`${app.base}/jobs/${jobId}`, { waitUntil: "networkidle" });
      const del = page.getByRole("button", { name: "Delete", exact: true });
      await del.hover();
      await page.getByRole("tooltip").filter({ hasText: "Delete job" }).waitFor();
      assert.equal(await del.getAttribute("title"), null, "no native title");
      await page.mouse.move(0, 0);
      await page.getByRole("tooltip").waitFor({ state: "detached" });
    });
  });

  it("arrow keys move between a job's tabs", async () => {
    await ui.step("tab keys", async () => {
      const { page } = ui;
      await page.goto(`${app.base}/jobs/${jobId}`, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: /^Fit/ }).focus();
      await page.keyboard.press("ArrowRight");
      assert.equal(await page.getByRole("button", { name: /^Resume check/ }).getAttribute("aria-current"), "page");
      await page.keyboard.press("End");
      assert.equal(await page.getByRole("button", { name: /^Application/ }).getAttribute("aria-current"), "page");
    });
  });
});
