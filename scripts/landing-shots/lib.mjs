import { chromium } from "playwright-core";
import { BASE, COOKIE } from "./env.mjs";
export { BASE };

/** The app's localStorage key hash (src/lib/storage.ts). */
export function hashText(text) { let h = 0; for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }

/** A signed-in light-mode page with the tour dismissed and the fictional careers site routed. */
export async function open({ width = 1600, height = 785, scale = 1.5, storage = {} } = {}) {
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, colorScheme: "light", timezoneId: "America/Los_Angeles" });
  const [name, value] = COOKIE.split("=");
  await ctx.addCookies([{ name, value, url: BASE }]);
  const init = { has_completed_onboarding_wizard_v1: "true", ...storage };
  await ctx.addInitScript((kv) => { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); }, init);
  await ctx.route("https://careers.example.com/**", async (route) => {
    const { careersPage } = await import("./careers.mjs");
    await route.fulfill({ status: 200, contentType: "text/html", body: careersPage(new URL(route.request().url())) });
  });
  const page = await ctx.newPage();
  return { browser, ctx, page };
}
