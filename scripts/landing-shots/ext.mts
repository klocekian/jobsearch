// Extension clip/fill shots: a fictional careers page beside the real side panel
// (chrome-extension/sidepanel.html + popup.js), with the chrome.* APIs stubbed
// and its API calls proxied to the demo server.
import fs from "node:fs";
import { chromium } from "playwright-core";
import { BASE, COOKIE, OUT } from "./env.mjs";
import { careersPage } from "./careers.mjs";

const ROOT = new URL("../../", import.meta.url).pathname;
const EXT = ROOT + "chrome-extension/";
const LOCAL = BASE;
const cookie = COOKIE as string;
const JOB_URL = "https://careers.example.com/meridian/head-of-design-7c2e41";

const browser = await chromium.launch({ channel: "chrome" });

async function context(scale: number, width: number, height: number) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale });
  await ctx.route("https://careers.example.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: careersPage(new URL(route.request().url())) }));
  return ctx;
}

// What content.js extracts from the careers page, exactly as the extension would.
const probe = await (await context(1, 1280, 800)).newPage();
await probe.goto(JOB_URL);
const pageData = await probe.evaluate(fs.readFileSync(EXT + "content.js", "utf8"));

const STUB = `<script>
window.chrome = {
  storage: { local: { get: async () => ({ recentCollapsed: false }), set: async () => {} } },
  tabs: { query: async () => [{ id: 1, url: ${JSON.stringify(JOB_URL)} }] },
  scripting: { executeScript: async (o) => [{ result: o.files ? ${JSON.stringify(pageData)} : 14 }] },
};
</script>`;

async function wire(ctx: Awaited<ReturnType<typeof context>>) {
  await ctx.route("https://jobs.fieldlines.org/**", async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname.startsWith("/__ext/")) {
      const file = u.pathname.slice("/__ext/".length);
      let body = fs.readFileSync(EXT + file, "utf8");
      if (file.endsWith(".html")) body = body.replace("<script", STUB + "<script");
      return route.fulfill({ contentType: file.endsWith(".js") ? "text/javascript" : "text/html", body });
    }
    const res = await route.fetch({ url: LOCAL + u.pathname + u.search, headers: { ...route.request().headers(), cookie } });
    return route.fulfill({ response: res });
  });
  await ctx.route("https://shots.example.com/wrap*", (route) => {
    const u = new URL(route.request().url());
    const left = u.searchParams.get("left")!;
    const icon = "data:image/png;base64," + fs.readFileSync(EXT + "icon48.png").toString("base64");
    route.fulfill({ contentType: "text/html", body: `<!doctype html><html><body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,sans-serif">
<div style="display:flex;height:100vh">
  <iframe id="page" src="${left}" style="flex:1;border:0"></iframe>
  <div style="width:340px;background:#f1f3f4;border-left:1px solid #dadce0;display:flex;flex-direction:column">
    <div style="display:flex;align-items:center;gap:8px;height:36px;padding:0 12px;font-size:13px;color:#202124">
      <img src="${icon}" width="16" height="16"><span style="flex:1">Job Search Clipper</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5f6368" stroke-width="2"><path d="M12 17v5M9 3h6l-1 7 4 3H6l4-3z"/></svg>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5f6368" stroke-width="2" style="margin-left:10px"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </div>
    <iframe id="panel" data-rect src="https://jobs.fieldlines.org/__ext/sidepanel.html" style="flex:1;border:0;background:#fff;border-radius:10px 10px 0 0;margin:0 6px"></iframe>
  </div>
</div></body></html>` });
  });
}

async function shoot(scale: number, suffix: string) {
  const ctx = await context(scale, 1600, 788);
  await wire(ctx);
  const page = await ctx.newPage();
  const panelFrame = () => page.frames().find((f) => f.url().includes("sidepanel.html"))!;

  // Clip: the posting on the left, the captured fields on the right.
  await page.goto("https://shots.example.com/wrap?left=" + encodeURIComponent(JOB_URL), { waitUntil: "networkidle" });
  await panelFrame().click("#clipBtn");
  await page.waitForTimeout(1500);
  await save(page, "extension-clip", suffix);

  // Fill: the application form filled on the left, the saved fields on the right.
  await page.goto("https://shots.example.com/wrap?left=" + encodeURIComponent(JOB_URL + "?tab=application&filled=1"), { waitUntil: "networkidle" });
  await panelFrame().click("#tabFill");
  await page.waitForTimeout(1200);
  await page.frames().find((f) => f.url().includes("careers.example.com"))!.evaluate(() => scrollTo(0, 330));
  await page.waitForTimeout(300);
  await save(page, "extension-fill", suffix);
  await ctx.close();
}
// Same panel at desktop scale, composited over the iframe (see compose.py).
{
  const ctx = await context(1.5, 327, 752);
  await wire(ctx);
  const page = await ctx.newPage();
  await page.goto("https://jobs.fieldlines.org/__ext/sidepanel.html", { waitUntil: "networkidle" });
  await page.click("#clipBtn");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: OUT + "extension-clip-panel-1x5.png" });
  await page.click("#tabFill");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT + "extension-fill-panel-1x5.png" });
  await ctx.close();
}

async function save(page: import("playwright-core").Page, name: string, suffix: string) {
  if (suffix) {
    // Phone crop: just the panel.
    const box = (await page.locator("#panel").boundingBox())!;
    await page.screenshot({ path: OUT + name + suffix + ".png", clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
  } else {
    await page.screenshot({ path: OUT + name + ".png" });
  }
}

await shoot(1.5, "");

// Phone crops: the panel alone, rendered top-level so its text stays sharp.
{
  const ctx = await context(2, 328, 760);
  await wire(ctx);
  const page = await ctx.newPage();
  await page.goto("https://jobs.fieldlines.org/__ext/sidepanel.html", { waitUntil: "networkidle" });
  await page.click("#clipBtn");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: OUT + "extension-clip-panel.png" });
  await page.click("#tabFill");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT + "extension-fill-panel.png" });
  await ctx.close();
}
await browser.close();
