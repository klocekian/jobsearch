// Seeds demo@example.com with a fictional job search for the landing-page shots.
// Run through run.sh, which points TURSO_DATABASE_URL at a throwaway SQLite file.
import { getDb } from "@/lib/db";
import { upsertUser } from "@/lib/db/users";
import { createJob } from "@/lib/db/jobs";
import { createResume } from "@/lib/db/resumes";
import { upsertCandidateDoc } from "@/lib/db/candidate-docs";
import { upsertUserAIProvider } from "@/lib/db/ai-providers";
import { analyze } from "@/lib/analysis/analyze";
import * as C from "./content.mjs";

const db = await getDb();
const user = await upsertUser({ email: "demo@example.com", name: C.PERSON.name });
const uid = user.id;

for (const t of ["jobs", "resumes", "candidate_docs", "user_ai_providers"]) {
  await db.execute({ sql: `DELETE FROM ${t} WHERE user_id = ?`, args: [uid] });
}
await db.execute({
  sql: "UPDATE users SET profile_data = ?, mcp_last_used_at = ? WHERE id = ?",
  args: [JSON.stringify({
    first_name: C.PERSON.first, last_name: C.PERSON.last, full_name: C.PERSON.name,
    email: C.PERSON.email, phone: C.PERSON.phone, address: "", city: C.PERSON.city, state: C.PERSON.state,
    current_title: C.PERSON.title, current_company: C.PERSON.company,
    linkedin: C.PERSON.linkedin, github: "", website: C.PERSON.website, substack: "",
    work_authorized: true, sponsorship_required: false,
  }), "2026-10-09T16:42:00.000Z", uid],
});

// Deterministic PRNG so reruns give the same pipeline.
let seed = 20261009;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];

const NOW = Date.UTC(2026, 9, 9, 17, 0, 0);
const DAY = 86400000;
const ts = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace("T", " ");
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);

const A = ["Alder", "Beacon", "Bluefin", "Cinder", "Clearwater", "Cobalt", "Copperleaf", "Driftwood", "Elmstead", "Ember", "Foxglove", "Granite", "Harrow", "Hollis", "Ironwood", "Juniper", "Keel", "Larkspur", "Lowell", "Marigold", "Meadowlark", "Moss", "Northstar", "Oakhurst", "Orchard", "Palisade", "Pinecrest", "Quarry", "Redwing", "Riverstone", "Saltbox", "Sable", "Sparrow", "Stillwater", "Summit", "Thistle", "Tidepool", "Umber", "Upland", "Vantage", "Verdant", "Wayfarer", "Westbrook", "Wren", "Yarrow", "Zephyr"];
const B = ["Labs", "Health", "AI", "Bank", "Analytics", "Systems", "Robotics", "Learning", "Energy", "Commerce", "Software", "Bio", "Mobility", "Insurance", "Logistics", "Pay", "Data", "Cloud", "Security", "Studio"];
const TITLES = ["Principal Product Designer", "Staff Product Designer", "Lead Product Designer", "Design Manager", "Senior Product Designer", "Head of Design", "Director of Product Design", "Principal UX Designer", "Staff Product Designer, Platform", "Product Design Lead, AI", "Senior Design Manager", "Principal Designer, Design Systems", "Lead Product Designer, Growth", "Staff Designer, Developer Experience", "Design Lead, Payments"];
const LOCS: [string, string][] = [["San Francisco, CA", "hybrid"], ["Remote (US)", "remote"], ["Seattle, WA", "hybrid"], ["Portland, OR", "hybrid"], ["New York, NY", "hybrid"], ["Austin, TX", "onsite"], ["Remote", "remote"], ["Los Angeles, CA", "hybrid"], ["Denver, CO", "remote"], ["Boston, MA", "hybrid"]];

const usedNames = new Set(["Kestrel AI", "Fernway", "Tidewell Bank", "Meridian Analytics"]);
function company() {
  for (;;) {
    const n = `${pick(A)} ${pick(B)}`;
    if (!usedNames.has(n)) { usedNames.add(n); return n; }
  }
}
function salary() {
  const lo = 150 + Math.floor(rand() * 9) * 10;
  const hi = lo + 30 + Math.floor(rand() * 5) * 10;
  const style = rand();
  const text = style < 0.4 ? `$${lo},000 – $${hi},000` : style < 0.75 ? `$${lo}k–$${hi}k` : `$${lo},000 - $${hi},000 annually`;
  return { salary_min: lo * 1000, salary_max: hi * 1000, salary_text: text };
}

// status, previous_status, count
const PLAN: [string, string | null, number][] = [
  ["saved", null, 31], ["applying", null, 3], ["applied", null, 44],
  ["interview", null, 4], ["interview2", null, 4], ["onsite", null, 2], ["offer", null, 1],
  ["rejected", "applied", 29], ["rejected", "interview", 4], ["rejected", "interview2", 2], ["rejected", "onsite", 1],
  ["abandoned", "saved", 7], ["abandoned", "applying", 1], ["withdrawn", "interview2", 1], ["declined", "offer", 1],
  ["closed", null, 4],
];
const SUBMITTED = new Set(["applied", "interview", "interview2", "onsite", "offer", "accepted"]);

const bulk: Parameters<typeof createJob>[0][] = [];
for (const [status, prev, count] of PLAN) {
  for (let i = 0; i < count; i++) {
    // Earlier stages skew recent; later stages skew older.
    const furthest = prev ?? status;
    const ageBias = { saved: 0.35, applying: 0.2, applied: 0.6, interview: 0.7, interview2: 0.8, onsite: 0.85, offer: 0.9 }[furthest] ?? 0.6;
    const ageDays = 3 + Math.floor((ageBias * 0.6 + rand() * 0.6) * 140);
    const created = NOW - ageDays * DAY - Math.floor(rand() * DAY);
    const [location, remote_type] = pick(LOCS);
    const submitted = SUBMITTED.has(furthest);
    const hasFit = rand() < 0.7;
    bulk.push({
      user_id: uid, company: company(), title: pick(TITLES), location, remote_type, ...salary(),
      status, previous_status: prev, source: pick(["extension", "extension", "manual", "import"]),
      url: "", posting_text: "",
      fitness_score: hasFit ? Math.max(2, Math.min(10, Math.round(4 + rand() * 6))) : null,
      fitness_run_at: hasFit ? new Date(created + DAY).toISOString() : null,
      match_score: hasFit && rand() < 0.75 ? 60 + Math.floor(rand() * 38) : null,
      created_at: ts(created), updated_at: ts(created + 2 * DAY),
      applied_at: submitted ? ymd(created + Math.floor(1 + rand() * 4) * DAY) : null,
      is_starred: rand() < 0.08 ? 1 : 0,
    });
  }
}
bulk.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
for (const j of bulk) await createJob(j);

// Recent, presentable jobs at the top of the list (newest last).
const recent: [string, string, string, string, string, number | null, number | null][] = [
  ["Harrow Health", "Staff Product Designer, Clinician Tools", "Seattle, WA", "applied", "$190,000 – $230,000", 7, 84],
  ["Sparrow Pay", "Design Lead, Merchant Experience", "Remote (US)", "applied", "$180k–$215k", 8, 91],
  ["Northstar Learning", "Principal Product Designer", "Remote", "saved", "$195,000 – $240,000", 6, 78],
];
let t = NOW - 2 * DAY;
for (const [co, title, location, status, salary_text, fit, ats] of recent) {
  t += 3 * 3600 * 1000;
  await createJob({
    user_id: uid, company: co, title, location, remote_type: location.startsWith("Remote") ? "remote" : "hybrid",
    salary_text, status, fitness_score: fit, match_score: ats, source: "extension",
    fitness_run_at: new Date(t).toISOString(),
    created_at: ts(t), updated_at: ts(t), applied_at: status === "applied" ? ymd(t + 3600e3) : null,
  });
}

// Resumes.
const tagsMain = ["Sparrow Pay", "Harrow Health", "Northstar Learning", "Fernway", "Kestrel AI", "Tidewell Bank", "Ironwood Data", "Clearwater Bank", "Upland Health", "Bluefin Logistics", "Wren Software", "Beacon Analytics"];
const rows = await db.execute({ sql: "SELECT company FROM jobs WHERE user_id = ? AND applied_at IS NOT NULL ORDER BY created_at DESC LIMIT 60", args: [uid] });
const tagsOlder = [...new Set(rows.rows.map((r) => String(r.company)))].slice(12, 46);
await createResume(uid, { name: "Jordan Avery - Resume 2026", content: C.RESUME, file_name: "jordan-avery-resume-2026.pdf", is_default: true, tags: tagsMain });
await createResume(uid, { name: "Jordan Avery - Design Systems", content: C.RESUME_SYSTEMS, file_name: "jordan-avery-design-systems.pdf", tags: ["Copperleaf Software", "Granite Cloud", "Saltbox Studio", "Lowell Systems"] });
await createResume(uid, { name: "jordan-avery-resume-2025", content: C.RESUME_OLDER, file_name: "jordan-avery-resume-2025.md", tags: tagsOlder });
await db.execute({ sql: "UPDATE resumes SET updated_at = '2026-10-08 18:20:00' WHERE user_id = ? AND is_default = 1", args: [uid] });
await db.execute({ sql: "UPDATE resumes SET updated_at = '2026-08-21 17:05:00' WHERE user_id = ? AND name LIKE '%Design Systems'", args: [uid] });
await db.execute({ sql: "UPDATE resumes SET updated_at = '2026-05-14 16:30:00' WHERE user_id = ? AND name LIKE '%2025'", args: [uid] });

await upsertCandidateDoc(uid, "profile", C.PROFILE_DOC);
await upsertCandidateDoc(uid, "gaps", C.GAPS_DOC);
await db.execute({ sql: "UPDATE candidate_docs SET updated_at = '2026-10-08 21:10:00' WHERE user_id = ?", args: [uid] });

// AI providers (fake keys; nothing calls out with these).
await upsertUserAIProvider({ userId: uid, provider: "claude", apiKey: "sk-ant-demo-000000000000000000000000000000Q7rk", model: null, isActive: true });
await upsertUserAIProvider({ userId: uid, provider: "gemini", apiKey: "AIzaDemo00000000000000000000000000000x4Lm", model: null, isActive: false });

// Hero jobs, newest of all.
const match = (posting: string, company: string, jobTitle: string) =>
  analyze({ resumeText: C.RESUME, jobText: posting, company, jobTitle, jobUrl: "", fileName: "" });

t = NOW - 6 * 3600e3;
const tidewellReport = match(C.TIDEWELL_POSTING, "Tidewell Bank", "Principal Product Designer, Consumer");
const tidewell = await createJob({
  user_id: uid, company: "Tidewell Bank", title: "Principal Product Designer, Consumer", location: "New York, NY", remote_type: "hybrid",
  salary_text: "$200k–$240k", salary_min: 200000, salary_max: 240000, status: "saved", source: "extension",
  url: "https://careers.example.com/tidewell/principal-product-designer-consumer",
  posting_text: C.TIDEWELL_POSTING, fitness_score: 9, fitness_run_at: new Date(t).toISOString(),
  match_score: tidewellReport.score, match_report: JSON.stringify(tidewellReport), match_resume_name: "Jordan Avery - Resume 2026",
  created_at: ts(t), updated_at: ts(t),
});

t += 2 * 3600e3;
const fernwayReport = match(C.FERNWAY_POSTING, "Fernway", "Lead Product Designer, Payments");
const fernway = await createJob({
  user_id: uid, company: "Fernway", title: "Lead Product Designer, Payments", location: "Remote (US)", remote_type: "remote",
  salary_text: "$185,000 – $225,000", salary_min: 185000, salary_max: 225000, status: "saved", source: "extension",
  url: "https://careers.example.com/fernway/lead-product-designer-payments",
  posting_text: C.FERNWAY_POSTING, fitness_score: 8, fitness_run_at: new Date(t).toISOString(),
  match_score: fernwayReport.score, match_report: JSON.stringify(fernwayReport), match_resume_name: "Jordan Avery - Resume 2026",
  created_at: ts(t), updated_at: ts(t), is_starred: 1,
});

t += 2 * 3600e3;
const kestrelReport = match(C.KESTREL_POSTING, "Kestrel AI", "Principal Product Designer, Agent Workflows");
const kestrel = await createJob({
  user_id: uid, company: "Kestrel AI", title: "Principal Product Designer, Agent Workflows", location: "San Francisco, CA", remote_type: "hybrid",
  salary_text: "$215,000 – $265,000", salary_min: 215000, salary_max: 265000, status: "saved", source: "extension",
  url: "https://careers.example.com/kestrel/principal-product-designer-agent-workflows",
  posting_text: C.KESTREL_POSTING, fitness_score: 8, fitness_report: JSON.stringify(C.KESTREL_FITNESS), fitness_run_at: new Date(t).toISOString(),
  match_score: kestrelReport.score, match_report: JSON.stringify(kestrelReport), match_resume_name: "Jordan Avery - Resume 2026",
  created_at: ts(t), updated_at: ts(t),
});

console.log(JSON.stringify({ uid, kestrel: kestrel.id, fernway: fernway.id, tidewell: tidewell.id, fernwayScore: fernwayReport.score, tidewellScore: tidewellReport.score, fernwayMissing: fernwayReport.highlights.missing, matched: fernwayReport.highlights.matched?.slice?.(0, 30) }, null, 1));
