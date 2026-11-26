import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { startApp } from "../helpers/server.mjs";
import { openBrowser, pageErrors } from "../helpers/browser.mjs";

let app;
let ui;
let savedJob;
before(async () => {
  app = await startApp();
  await app.addUsers({ id: 1, email: "search@test", name: "Alex" });
  for (const [company, status] of [["Saved Studio", "saved"], ["Preparing Studio", "applying"], ["Waiting Studio", "applied"], ["Interview Studio", "interview2"]]) {
    const res = await app.req("POST", "/api/jobs", { body: { company, title: "Product Designer", status, posting_text: "User research, product design and prototyping." } });
    if (status === "saved") savedJob = res.data.job.id;
  }
  ui = await openBrowser(app, { onboardingDone: false });
  ui.page.setDefaultTimeout(10000);
  ui.page.setDefaultNavigationTimeout(15000);
  ui.page.on("dialog", (dialog) => dialog.accept());
});
after(async () => { await ui?.close(); await app?.stop(); });

describe("search cycle", () => {
  it("opens Explore without a mandatory tour, and shortlists persist", async () => {
    const { page } = ui;
    await page.goto(`${app.base}/jobs`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Explore" }).waitFor();
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.equal(await page.getByText("Waiting Studio", { exact: true }).count(), 0);
    await page.getByRole("button", { name: "Preview Preparing Studio Product Designer", exact: true }).click();
    await page.getByRole("complementary", { name: "Job preview" }).getByText("Preparing Studio", { exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/jobs", "previewing a role keeps the job list open");
    await page.getByRole("complementary", { name: "Job preview" }).getByText("User research, product design and prototyping.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Add Saved Studio Product Designer to shortlist" }).click();
    await page.getByRole("button", { name: "Remove Saved Studio Product Designer from shortlist" }).waitFor();
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Shortlisted", exact: true }).click();
    assert.equal(await page.getByRole("region", { name: "Opportunities" }).getByText("Saved Studio", { exact: true }).count(), 1);
    assert.equal(await page.getByRole("region", { name: "Opportunities" }).getByText("Preparing Studio", { exact: true }).count(), 0);
    await page.getByRole("textbox", { name: "Search jobs" }).fill("does not exist");
    await page.getByRole("heading", { name: "No roles match this view" }).waitFor();
  });

  it("saves preparation and reflection notes, retaining drafts after failed writes", async () => {
    const { page } = ui;
    await page.goto(`${app.base}/jobs?phase=prepare`, { waitUntil: "networkidle" });
    const learning = page.getByLabel("What to improve or learn next", { exact: false });
    await learning.fill("Practice the research impact story");
    await page.getByLabel("Feedback & reflections", { exact: false }).fill("Recruiter asked how research changed the roadmap");
    await page.route("**/api/search-plan", async (route) => {
      if (route.request().method() === "PUT") await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Temporary save failure" }) });
      else await route.continue();
    });
    await page.getByRole("button", { name: "Save preparation notes" }).click();
    await page.getByRole("alert").filter({ hasText: "Temporary save failure" }).waitFor();
    assert.equal(await learning.inputValue(), "Practice the research impact story");
    await page.unroute("**/api/search-plan");
    await page.getByRole("button", { name: "Save preparation notes" }).click();
    await page.getByText("Your preparation notes are saved.").waitFor();
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await learning.inputValue(), "Practice the research impact story");
    await page.locator("summary").first().click();
    assert.ok(await page.locator("details[open] a").count() >= 2);
  });

  it("creates and copies a reusable resume without overwriting the original", async () => {
    const { page } = ui;
    await page.getByRole("button", { name: "Add resume", exact: true }).click();
    await page.getByLabel("Resume name", { exact: true }).fill("Design leadership");
    await page.getByLabel("Resume content", { exact: true }).fill("Alex\nProduct designer. Led user research and prototyping.");
    await page.getByRole("button", { name: "Save resume", exact: true }).click();
    await page.getByText("Resume added to your library.").waitFor();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByLabel("Resume content", { exact: true }).fill("Alex\nA revised, more specific research impact story.");
    await page.getByRole("button", { name: "Save as new version" }).click();
    await page.getByRole("heading", { name: "Design leadership (copy)", exact: true }).waitFor();
    const resumes = (await app.req("GET", "/api/resumes")).data.resumes;
    assert.equal(resumes.length, 2);
    assert.match(resumes.find((r) => r.name === "Design leadership").content, /Led user research/);
    assert.match(resumes.find((r) => r.name.endsWith("(copy)")).content, /revised/);
  });

  it("separates conversations, preparation and waiting, with working detail links", async () => {
    const { page } = ui;
    await page.goto(`${app.base}/jobs?phase=applications`, { waitUntil: "networkidle" });
    for (const name of ["Conversations", "Preparing", "Awaiting response"]) {
      await page.getByRole("heading", { name: new RegExp(name) }).waitFor();
    }
    assert.equal(await page.getByText("Saved Studio", { exact: true }).count(), 0);
    await page.goto(`${app.base}/jobs/${savedJob}?view=prepare`, { waitUntil: "networkidle" });
    assert.equal(await page.getByRole("button", { name: "Prepare", exact: true }).getAttribute("aria-current"), "page");
    await page.goto(`${app.base}/jobs/${savedJob}?view=application`, { waitUntil: "networkidle" });
    assert.equal(await page.getByRole("button", { name: "Application", exact: true }).getAttribute("aria-current"), "page");
  });

  it("renders all phases on mobile without overflow or hydration errors", async () => {
    const { page } = ui;
    await page.setViewportSize({ width: 390, height: 844 });
    for (const phase of ["explore", "prepare", "applications"]) {
      await page.goto(`${app.base}/jobs?phase=${phase}`, { waitUntil: "networkidle" });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, phase);
    }
    assert.deepEqual(pageErrors(ui.errors), []);
  });
});
