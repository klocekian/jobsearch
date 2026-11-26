// Captures the app screenshots on the landing page from the seeded demo account.
// Run through run.sh; pass shot names to take only those.
import { open, BASE, hashText } from "./lib.mjs";
import { OUT } from "./env.mjs";
import * as C from "./content.mjs";
import { getIds } from "./ids.mjs";

const only = process.argv.slice(2);
const ids = await getIds();
// Drafts are stored per job (src/lib/storage.ts).
const storage = {
  [`jobsearch.aidetect.${hashText(C.RESUME)}`]: JSON.stringify(C.AI_DETECTION),
  [`jobsearch.rewrite.v2.${ids.fernway}`]: JSON.stringify({ base: C.RESUME, rewrite: C.FERNWAY_REWRITE, result: C.RESUME, dismissed: [] }),
  [`jobsearch.coverletter.v3.${ids.tidewell}`]: JSON.stringify(C.TIDEWELL_COVER),
};

type Page = Awaited<ReturnType<typeof open>>["page"];
type Rect = { x: number; y: number; width: number; height: number };

async function job(page: Page, id: number) {
  await page.goto(BASE + `/jobs/${id}`, { waitUntil: "networkidle" });
  const hide = page.getByRole("button", { name: "Hide activity details" });
  if (await hide.count()) await hide.click();
  await page.mouse.move(0, 0);
}
const analysisTab = (page: Page, name: RegExp) => page.getByRole("navigation", { name: "Analysis views" }).getByRole("button", { name });
const settle = async (page: Page, ms = 700) => { await page.mouse.move(0, 0); await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur()); await page.waitForTimeout(ms); };

/** Scroll the analysis pane so the leaf with `text` sits `offset` px below its top. */
async function scrollPane(page: Page, text: string, offset = 0) {
  await page.evaluate(([t, off]) => {
    const pane = document.querySelector('section[aria-label="Analysis"]')!;
    const body = pane.lastElementChild as HTMLElement;
    const el = [...body.querySelectorAll("*")].find((e) => e.childElementCount === 0 && e.textContent?.trim() === t)!;
    body.scrollTop += el.getBoundingClientRect().top - body.getBoundingClientRect().top - (off as number);
  }, [text, offset] as const);
  await page.waitForTimeout(300);
}
/** The analysis pane (activity strip, tabs and content), with a little margin. */
const paneRect = (page: Page): Promise<Rect> => page.evaluate(() => {
  const r = document.querySelector('section[aria-label="Analysis"]')!.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
});
/** The pane's content area, below its tabs. */
const paneBody = (page: Page): Promise<Rect> => page.evaluate(() => {
  const r = document.querySelector('section[aria-label="Analysis"]')!.lastElementChild!.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
});
const leafTop = (page: Page, text: string) => page.evaluate((t) => {
  const el = [...document.querySelectorAll("*")].find((e) => e.childElementCount === 0 && e.textContent?.trim() === t)!;
  return el.getBoundingClientRect().top + scrollY;
}, text);
const cardOf = (page: Page, text: string) => page.evaluate((t) => {
  const el = [...document.querySelectorAll("*")].find((e) => e.childElementCount === 0 && e.textContent?.trim() === t)!;
  const card = el.closest('[class*="__card"]') as HTMLElement;
  const r = card.getBoundingClientRect();
  return { x: r.x, y: r.y + scrollY, width: r.width, height: r.height, bottom: r.bottom + scrollY };
}, text);

const shots: Record<string, (page: Page) => Promise<void>> = {
  // Hero: the Explore workspace.
  async dashboard(page) {
    await page.goto(BASE + "/jobs?phase=explore", { waitUntil: "networkidle" });
    await settle(page);
    await page.screenshot({ path: OUT + "pipeline-dashboard.png" });
  },
  async drilldown(page) {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(BASE + "/jobs?view=tracker", { waitUntil: "networkidle" });
    await page.getByText("Recruiter", { exact: true }).first().click();
    await settle(page, 600);
    const card = await cardOf(page, "Application pipeline");
    const banner = await page.evaluate(() => {
      const b = [...document.querySelectorAll("*")].find((e) => e.childElementCount === 0 && e.textContent?.includes("This is a numbers game"));
      return b ? (b.closest(".rounded-lg") as HTMLElement).getBoundingClientRect().top + scrollY : null;
    });
    const top = (banner ?? card.y) - 12;
    await page.screenshot({ path: OUT + "pipeline-drilldown.png", clip: { x: card.x - 12, y: top, width: card.width + 24, height: card.bottom + 12 - top } });
  },
  async fitness() {
    const { browser: b2, page } = await open({ width: 1240, height: 680, scale: 2.4, storage });
    await job(page, ids.kestrel);
    await settle(page, 800);
    await page.screenshot({ path: OUT + "fitness-check.png", clip: await paneRect(page) });
    await b2.close();
  },
  async ats() {
    const { browser: b2, page } = await open({ width: 1240, height: 680, scale: 2.4, storage });
    await job(page, ids.fernway);
    await analysisTab(page, /^Resume check/).click();
    await settle(page, 900);
    await page.screenshot({ path: OUT + "ats-qualification.png", clip: await paneRect(page) });
    await b2.close();
  },
  async slop() {
    const { browser: b2, page } = await open({ width: 1600, height: 900, scale: 2.2, storage });
    await job(page, ids.fernway);
    await analysisTab(page, /^Resume check/).click();
    await page.waitForTimeout(600);
    await page.getByText(/^AI slop/).first().click();
    await settle(page, 500);
    const pane = await paneRect(page);
    const tabs = await page.evaluate(() => document.querySelector('nav[aria-label="Analysis views"]')!.getBoundingClientRect().top);
    const last = await page.evaluate(() => [...document.querySelectorAll("*")].filter((e) => e.childElementCount === 0 && e.textContent?.startsWith("e.g.")).pop()!.getBoundingClientRect().bottom);
    await page.screenshot({ path: OUT + "ai-authenticity.png", clip: { x: pane.x, y: tabs, width: pane.width, height: Math.min(last + 20, pane.y + pane.height) - tabs } });
    await b2.close();
  },
  async rewriter(page) {
    await job(page, ids.fernway);
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await analysisTab(page, /^Prepare/).click();
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: "Edit", exact: true }).last().click();
    await settle(page, 1500);
    await page.screenshot({ path: OUT + "tailored-rewriter.png" });
  },
  async cover(page) {
    await job(page, ids.tidewell);
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await analysisTab(page, /^Prepare/).click();
    await page.getByRole("group", { name: "Prepare" }).getByRole("button", { name: "Cover letter" }).click();
    await settle(page, 1500);
    await scrollPane(page, "Letter header", 64);
    await page.screenshot({ path: OUT + "cover-letter.png" });
  },
  async profilePages() {
    const { browser: b2, page: p } = await open({ width: 1000, height: 1000, scale: 2, storage });
    const tab = async (name: string) => { await p.getByRole("navigation", { name: "Settings sections" }).getByRole("button", { name, exact: true }).click(); await settle(p, 800); };
    await p.goto(BASE + "/profile", { waitUntil: "networkidle" });
    const pad = 20;
    const tabsTop = await p.evaluate(() => document.querySelector('nav[aria-label="Settings sections"]')!.getBoundingClientRect().top + scrollY);
    const content = await p.evaluate(() => { const r = document.querySelector('nav[aria-label="Settings sections"]')!.getBoundingClientRect(); return { x: r.x, width: r.width }; });
    // Candidate profile: tabs through the end of the second document.
    await tab("Candidate profile");
    const areas = await p.evaluate(() => [...document.querySelectorAll("textarea, [class*='prose']")].map((e) => e.getBoundingClientRect().bottom + scrollY));
    const end = Math.max(...areas.slice(0, 2));
    await p.screenshot({ path: OUT + "candidate-profile.png", fullPage: true, clip: { x: content.x - pad, y: tabsTop - 14, width: content.width + 2 * pad, height: Math.min(end, tabsTop + 900) + pad - (tabsTop - 14) } });
    // AI providers + MCP, ending before the Claude Code command.
    await tab("AI & connectors");
    const cc = await leafTop(p, "Claude Code");
    await p.screenshot({ path: OUT + "ai-providers.png", fullPage: true, clip: { x: content.x - pad, y: tabsTop - 14, width: content.width + 2 * pad, height: cc - 16 - (tabsTop - 14) } });
    // Resumes card.
    await tab("Resumes");
    const rc = await p.evaluate(() => { const r = document.querySelector('[class*="__card"]')!.getBoundingClientRect(); return { x: r.x, y: r.y + scrollY, w: r.width, h: r.height }; });
    await p.screenshot({ path: OUT + "resumes.png", fullPage: true, clip: { x: rc.x - 6, y: rc.y - 6, width: rc.w + 12, height: Math.min(rc.h + 12, 800) } });
    await b2.close();
  },
  async importSheet() {
    const { browser: b2, page: p } = await open({ width: 1200, height: 800, scale: 2, storage });
    await p.goto(BASE + "/jobs?view=tracker", { waitUntil: "networkidle" });
    await p.getByRole("button", { name: "Import from Google Sheet" }).click();
    await p.waitForTimeout(600);
    const dialog = p.locator(".fixed.inset-0 > div").first();
    const input = dialog.locator("input").first();
    await input.fill("https://docs.google.com/spreadsheets/d/1Xq7DemoJobTracker2026aVt9pLm/edit#gid=0");
    await input.evaluate((e) => (e as HTMLInputElement).blur());
    await p.addStyleTag({ content: ".fixed.inset-0{background:var(--color-background-subtle)!important;backdrop-filter:none!important}" });
    await p.waitForTimeout(300);
    const r = (await dialog.boundingBox())!;
    await p.screenshot({ path: OUT + "import-sheet.png", clip: { x: r.x - 14, y: r.y - 14, width: r.width + 28, height: r.height + 28 } });
    await b2.close();
  },

  // Phone crops: the same views at a higher scale, clipped to what a phone shows.
  async mobile() {
    const { browser: b2, page: p } = await open({ width: 1600, height: 785, scale: 2.2, storage });
    const crop = async (file: string, ratio: number, fromText?: string) => {
      if (fromText) await scrollPane(p, fromText, 12);
      const b = await paneBody(p);
      const top = fromText ? b.y + 2 : b.y + 8;
      await p.screenshot({ path: OUT + file + "-mobile.png", clip: { x: b.x + 4, y: top, width: b.width - 8, height: Math.round((b.width - 8) * ratio) } });
    };
    await job(p, ids.fernway);
    await analysisTab(p, /^Resume check/).click();
    await settle(p, 900);
    await crop("ats-qualification", 757 / 1200);
    await analysisTab(p, /^Prepare/).click();
    await p.waitForTimeout(500);
    await p.getByRole("button", { name: "Edit", exact: true }).last().click();
    await settle(p, 1200);
    await crop("tailored-rewriter", 757 / 1200);
    await job(p, ids.tidewell);
    await analysisTab(p, /^Prepare/).click();
    await p.getByRole("group", { name: "Prepare" }).getByRole("button", { name: "Cover letter" }).click();
    await settle(p, 1200);
    await crop("cover-letter", 757 / 1200, "Letter header");
    await job(p, ids.kestrel);
    await settle(p, 700);
    await crop("fitness-check", 630 / 1200, "Gaps and framings");

    // Hero on a phone: Explore at phone width.
    await p.setViewportSize({ width: 400, height: 900 });
    await p.goto(BASE + "/jobs?phase=explore", { waitUntil: "networkidle" });
    await settle(p, 700);
    await p.screenshot({ path: OUT + "pipeline-dashboard-mobile.png", clip: { x: 0, y: 0, width: 400, height: 430 } });

    // Recruiter drilldown, left part of the pipeline card.
    await p.setViewportSize({ width: 1600, height: 1000 });
    await p.goto(BASE + "/jobs?view=tracker", { waitUntil: "networkidle" });
    await p.getByText("Recruiter", { exact: true }).first().click();
    await settle(p, 600);
    const c = await cardOf(p, "Application pipeline");
    const w = Math.round(c.width * 0.56);
    await p.screenshot({ path: OUT + "pipeline-drilldown-mobile.png", clip: { x: c.x + 6, y: c.y + 14, width: w, height: Math.min(Math.round(w * 1061 / 1200), c.height - 24) } });

    // Candidate profile: tabs through the fact canon.
    await p.setViewportSize({ width: 900, height: 1000 });
    await p.goto(BASE + "/profile?tab=candidate", { waitUntil: "networkidle" });
    await settle(p, 800);
    const r = await p.evaluate(() => {
      const h = [...document.querySelectorAll("h2, h3")].find((e) => e.textContent?.trim() === "Candidate profile")!.getBoundingClientRect();
      const t = document.querySelector("textarea, [class*='prose']")!.getBoundingClientRect();
      return { x: t.x - 16, y: h.y - 12, width: t.width + 32 };
    });
    await p.screenshot({ path: OUT + "candidate-profile-mobile.png", clip: { ...r, height: Math.round(r.width * 749 / 1200) } });
    await b2.close();
  },
};

const { browser, page } = await open({ storage });
for (const [name, fn] of Object.entries(shots)) {
  if (only.length && !only.includes(name)) continue;
  await page.setViewportSize({ width: 1600, height: 785 });
  await fn(page);
  console.log("shot", name);
}
await browser.close();
