import { NextResponse } from "next/server";
import { z } from "zod";
import { withUser } from "@/lib/api-auth";
import { parseBody } from "@/lib/api-response";
import { getDb } from "@/lib/db";
import { getSetting, setSetting } from "@/lib/db/settings";
import { EMPTY_SEARCH_PLAN, recurringSkills } from "@/lib/search-workflow";

export const runtime = "nodejs";
const PlanSchema = z.object({ focus: z.string().max(4000), learning: z.string().max(20000), feedback: z.string().max(20000) });
// Derive the key exclusively from the authenticated session, never a request field.
const planKey = (userId: number) => `search-plan:${userId}`;

export const GET = withUser(async (_request, userId) => {
  const db = await getDb();
  const [stored, result] = await Promise.all([
    getSetting(planKey(userId)),
    db.execute({ sql: "SELECT id, title, company, posting_text FROM jobs WHERE user_id = ? AND status IN ('saved', 'applying') AND posting_text != ''", args: [userId] }),
  ]);
  const jobs = result.rows.map((r) => ({ id: Number(r.id), title: String(r.title), company: String(r.company), posting_text: String(r.posting_text) }));
  return NextResponse.json({ plan: stored ? PlanSchema.parse(JSON.parse(stored)) : EMPTY_SEARCH_PLAN, patterns: recurringSkills(jobs), postingCount: jobs.length }, { headers: { "Cache-Control": "no-store" } });
});

export const PUT = withUser(async (request, userId) => {
  const parsed = await parseBody(request, PlanSchema);
  if (parsed.error) return parsed.error;
  await setSetting(planKey(userId), JSON.stringify(parsed.data));
  return NextResponse.json({ plan: parsed.data });
});
