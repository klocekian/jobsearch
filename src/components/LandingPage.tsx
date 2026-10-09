import Image from "next/image";
import { Button } from "@astryxdesign/core/Button";
import { Badge, type BadgeVariant } from "@astryxdesign/core/Badge";

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" className="shrink-0">
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
    <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
  </svg>
);

function BrowserFrame({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-xl bg-zinc-950/80 shadow-2xl shadow-black/60 ${className}`}>
      {/* Chrome bar */}
      <div className="flex items-center gap-1.5 border-b border-border/60 bg-zinc-900/90 px-3 py-1.5">
        <span className="h-2 w-2 rounded-full bg-rose-500/80" />
        <span className="h-2 w-2 rounded-full bg-amber-500/80" />
        <span className="h-2 w-2 rounded-full bg-emerald-500/80" />
      </div>
      <div className="relative bg-white">
        {children}
      </div>
    </div>
  );
}

type Shot = { src: string; alt: string; width: number; height: number };

function Screenshot({ shot, priority }: { shot: Shot; priority?: boolean }) {
  return (
    <BrowserFrame>
      <Image
        src={shot.src}
        alt={shot.alt}
        width={shot.width}
        height={shot.height}
        sizes="(min-width: 1024px) 680px, 100vw"
        className="w-full h-auto block"
        priority={priority}
      />
    </BrowserFrame>
  );
}

const CHECK_COLORS = {
  emerald: "text-emerald-400",
  amber: "text-amber-400",
  purple: "text-purple-400",
  sky: "text-sky-400",
  teal: "text-teal-400",
  orange: "text-orange-400",
  pink: "text-pink-400",
  cyan: "text-cyan-400",
} as const;

type Bullet = { title: string; body: React.ReactNode };

function FeatureSection({
  id,
  badge,
  badgeVariant,
  title,
  intro,
  bullets,
  check = "emerald",
  shot,
  imageFirst = false,
  muted = false,
  footer,
}: {
  id?: string;
  badge: string;
  badgeVariant: BadgeVariant;
  title: React.ReactNode;
  intro: React.ReactNode;
  bullets: Bullet[];
  check?: keyof typeof CHECK_COLORS;
  shot: Shot;
  imageFirst?: boolean;
  muted?: boolean;
  footer?: React.ReactNode;
}) {
  return (
    <section id={id} className={`border-t border-border/50 py-16 sm:py-24 scroll-mt-20 ${muted ? "bg-muted/20" : ""}`}>
      <div className="mx-auto max-w-6xl px-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className={`lg:col-span-5 space-y-4 ${imageFirst ? "order-1 lg:order-2" : ""}`}>
            <Badge variant={badgeVariant} label={badge} />
            <h2 className="text-2xl sm:text-3xl font-bold text-primary tracking-tight">{title}</h2>
            <p className="text-sm text-secondary leading-relaxed">{intro}</p>
            <ul className="space-y-3 pt-2 text-xs sm:text-sm text-primary">
              {bullets.map((b) => (
                <li key={b.title} className="flex items-start gap-2.5">
                  <span className={`${CHECK_COLORS[check]} font-bold mt-0.5`}>✓</span>
                  <span><strong>{b.title}</strong>: {b.body}</span>
                </li>
              ))}
            </ul>
            {footer}
          </div>
          <div className={`lg:col-span-7 ${imageFirst ? "order-2 lg:order-1" : ""}`}>
            <Screenshot shot={shot} />
          </div>
        </div>
      </div>
    </section>
  );
}

const SHOTS = {
  dashboard: { src: "/hero/pipeline-dashboard.webp", alt: "Application pipeline chart, drop-off table and job list with fitness and ATS scores", width: 2400, height: 1177 },
  drilldown: { src: "/hero/pipeline-drilldown.webp", alt: "Pipeline stage drill-down listing every job at the Recruiter stage and the path it took", width: 2400, height: 1382 },
  clip: { src: "/hero/extension-clip.webp", alt: "Job Search Clipper side panel extracting company, title, salary and description from a careers page", width: 2400, height: 1182 },
  fitness: { src: "/hero/fitness-check.webp", alt: "Fitness check scoring a posting 9/10 with Meet and Adjacent verdicts per requirement", width: 2400, height: 1177 },
  profile: { src: "/hero/candidate-profile.webp", alt: "Candidate profile with a positive fact canon and a negative gaps profile", width: 1788, height: 1715 },
  ats: { src: "/hero/ats-qualification.webp", alt: "ATS pass score of 94/100 with searchability checks and highlighted skills in the posting", width: 2400, height: 1177 },
  slop: { src: "/hero/ai-authenticity.webp", alt: "AI slop score of 42% broken down into negative parallelism, narrative openers and clause rhythm", width: 1851, height: 1010 },
  rewriter: { src: "/hero/tailored-rewriter.webp", alt: "Tailored resume rewrite with inline accept/dismiss diffs beside the embedded application", width: 2400, height: 1177 },
  coverLetter: { src: "/hero/cover-letter.webp", alt: "Cover letter generator with letter header and editable draft beside the application", width: 2400, height: 1177 },
  fill: { src: "/hero/extension-fill.webp", alt: "Job Search Clipper Fill tab populating an Ashby application form", width: 2400, height: 1182 },
  providers: { src: "/hero/ai-providers.webp", alt: "AI provider settings for Anthropic Claude, Google Gemini, xAI Grok and Mistral AI", width: 1946, height: 1572 },
  connector: { src: "/hero/claude-connector.webp", alt: "Job Search connector inside claude.ai settings with its read-only and write tools", width: 1840, height: 1436 },
  importSheet: { src: "/hero/import-sheet.webp", alt: "Import jobs from a Google Sheet URL or CSV upload", width: 1018, height: 776 },
  resumes: { src: "/hero/resumes.webp", alt: "Multiple resumes, each tagged with the companies it was used for", width: 1714, height: 1419 },
} satisfies Record<string, Shot>;

const STEPS = [
  { n: "1", title: "Capture", body: "Clip postings from any job site with the Chrome extension, paste a URL, or import a Google Sheet.", color: "bg-sky-500/20 text-sky-400" },
  { n: "2", title: "Qualify", body: "Score your fitness 1–10 against each role's stated minimums before you invest an hour tailoring.", color: "bg-teal-500/20 text-teal-400" },
  { n: "3", title: "Tailor", body: "Push the ATS match past 90%, strip AI tells, and write a grounded cover letter.", color: "bg-purple-500/20 text-purple-400" },
  { n: "4", title: "Track", body: "Advance stages, archive what you submitted, keep notes, and read the funnel.", color: "bg-emerald-500/20 text-emerald-400" },
];

const MORE_FEATURES = [
  { title: "Add by URL or paste", body: "Fetch a posting from its link, or paste the full text and extract company, title, location and salary automatically." },
  { title: "Check closed postings", body: "One click re-checks every active posting and marks the ones the employer has taken down as Closed." },
  { title: "Thirteen pipeline statuses", body: "Saved through Accepted, plus Rejected, Declined, Withdrawn, Abandoned and Closed, so every outcome is counted honestly." },
  { title: "Guided onboarding tour", body: "A six-step walkthrough of capture, profile, fitness, tailoring and tracking you can relaunch any time." },
];

export function LandingPage() {
  return (
    <div className="relative min-h-screen bg-surface text-primary selection:bg-sky-500/30 selection:text-sky-200">
      {/* Background radial gradient glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[600px] overflow-hidden">
        <div className="absolute left-1/2 -top-24 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-b from-sky-500/15 via-emerald-500/10 to-transparent blur-3xl" />
      </div>

      {/* Hero Section */}
      <section className="mx-auto max-w-6xl px-5 pt-12 pb-16 sm:pt-20 sm:pb-24">
        <div className="text-center space-y-6 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3.5 py-1 text-xs font-medium text-sky-600 dark:text-sky-300">
            <span className="flex h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
            Executive Career Command Center
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-primary leading-[1.1] text-balance">
            <span className="block">Stop applying blindly into the void.</span>
            <span className="block mt-1 bg-gradient-to-r from-sky-500 via-teal-400 to-emerald-500 bg-clip-text text-transparent">
              Take command of your search.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-secondary leading-relaxed">
            The end-to-end qualification and tailoring engine. Target high-conviction roles, beat ATS filters with 90%+ precision, eliminate AI fluff, and convert applications into offers.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
            <a href="/api/auth/login" className="w-full sm:w-auto">
              <Button
                label="Sign in with Google"
                icon={<GoogleIcon />}
                size="lg"
                variant="primary"
                className="w-full sm:w-auto px-6 py-3 font-semibold shadow-lg shadow-sky-500/20"
              />
            </a>
            <a href="#how-it-works" className="w-full sm:w-auto">
              <Button
                label="Explore Features"
                size="lg"
                variant="secondary"
                className="w-full sm:w-auto"
              />
            </a>
          </div>

          {/* Social Proof / Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-8 border-t border-border/50 text-left">
            <div className="p-3 rounded-lg border border-border/40 bg-muted/40">
              <div className="text-lg font-bold text-primary">90%+</div>
              <div className="text-xs text-secondary">ATS match threshold</div>
            </div>
            <div className="p-3 rounded-lg border border-border/40 bg-muted/40">
              <div className="text-lg font-bold text-primary">Fit 1–10</div>
              <div className="text-xs text-secondary">Scored against your profile</div>
            </div>
            <div className="p-3 rounded-lg border border-border/40 bg-muted/40">
              <div className="text-lg font-bold text-primary">AI Slop 0%</div>
              <div className="text-xs text-secondary">Authenticity verification</div>
            </div>
            <div className="p-3 rounded-lg border border-border/40 bg-muted/40">
              <div className="text-lg font-bold text-primary">1-Click</div>
              <div className="text-xs text-secondary">Clip &amp; autofill extension</div>
            </div>
          </div>
        </div>

        {/* Hero Shot: Pipeline Command Center */}
        <div id="pipeline" className="mt-14 scroll-mt-20">
          <Screenshot shot={SHOTS.dashboard} priority />
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t border-border/50 bg-muted/30 py-16 sm:py-20 scroll-mt-20">
        <div className="mx-auto max-w-5xl px-5 text-center space-y-8">
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-primary">Not a tracking spreadsheet. A qualification engine.</h2>
            <p className="text-sm text-secondary max-w-xl mx-auto">
              Every role moves through the same four steps, so you spend your hours on the jobs you can actually win.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
            {STEPS.map((s) => (
              <div key={s.n} className="p-5 rounded-xl border border-border bg-surface/80 space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${s.color}`}>{s.n}</span>
                  <span className="font-semibold text-primary text-sm">{s.title}</span>
                </div>
                <p className="text-xs text-secondary leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <FeatureSection
        id="capture"
        badge="Chrome Extension"
        badgeVariant="cyan"
        check="cyan"
        title="Clip any posting in one click, from any job site."
        intro="Job boards, ATS portals, company career pages: the Job Search Clipper sits in Chrome's side panel and turns whatever posting you're reading into a tracked job with its full description."
        bullets={[
          { title: "Structured Extraction", body: "Company, title, location, remote policy, salary and the complete description are pulled out for you. Re-extract with AI when a page is messy." },
          { title: "Duplicate Detection", body: "Already-saved roles are flagged with their current status, and your recent clips stay one glance away." },
          { title: "Bulk Import", body: "Bring an existing search with you from a Google Sheet or a CSV upload." },
        ]}
        shot={SHOTS.clip}
        footer={
          <a href="/chrome-extension.zip" download className="inline-block pt-2 text-xs font-semibold text-cyan-600 hover:text-cyan-500 dark:text-cyan-300 dark:hover:text-cyan-200 transition-colors">
            Download the Chrome extension →
          </a>
        }
      />

      <FeatureSection
        badge="Funnel Intelligence"
        badgeVariant="blue"
        title="Turn your job search into a predictable numbers game."
        intro="Job searching is stressful when you don't know where you stand. The visual pipeline models your entire lifecycle from initial bookmark to signed offer, helping you pace applications and uncover conversion bottlenecks."
        bullets={[
          { title: "Full Conversion Funnel", body: "Track Saved → Applying → Applied → Recruiter Screen → Interview → Onsite → Offer." },
          { title: "Stage Drill-down", body: "Click any stage to list every role sitting there and the path each one took to get there." },
          { title: "Drop-off Diagnostics", body: "Clearly distinguish between rejections, expired postings, and intentional abandonments." },
          { title: "Adaptive Strategy Coaching", body: "A rotating banner nudges you: apply to 5 jobs a day, 25 a week, and calibrate selectivity as interviews ramp." },
        ]}
        shot={SHOTS.drilldown}
        imageFirst
        muted
      />

      <FeatureSection
        id="fitness"
        badge="Fitness Check"
        badgeVariant="teal"
        check="teal"
        title="Know whether you fit before you spend an hour tailoring."
        intro="Every posting is scored 1–10 against your candidate profile, one requirement at a time. You see exactly which minimums you meet, which you can argue, and which you can't."
        bullets={[
          { title: "Requirement-by-Requirement Verdicts", body: "Stated minimums, preferred qualifications and dispositional traits are each marked Meet, Adjacent or Miss. Dispositional traits never move the score." },
          { title: "Gaps & Framings", body: "Each gap comes with a prepared, honest response to rehearse aloud before the recruiter call." },
          { title: "Outcome Spectrum & Tradeoffs", body: "Best, probable and worst case for the application, plus what you gain and give up by pursuing it." },
          { title: "Rule-based or AI", body: "Runs deterministically out of the box; tick “with AI” for a deeper read." },
        ]}
        shot={SHOTS.fitness}
      />

      <FeatureSection
        id="profile"
        badge="Candidate Profile"
        badgeVariant="orange"
        check="orange"
        title="One source of truth about you. Nothing invented."
        intro="Fitness checks, rewrites and cover letters all draw on a single profile you control, so nothing ever claims experience you don't have."
        bullets={[
          { title: "Positive Profile (the Fact Canon)", body: "Verified figures, ownership scope and the technologies you actually hold." },
          { title: "Negative Profile", body: "Your gaps and standing reframes, such as on-site requirements or tools you haven't used, so they're flagged honestly instead of papered over." },
          { title: "Start from a Template", body: "Download sample profile.md and gaps.md files and fill them in." },
        ]}
        shot={SHOTS.profile}
        imageFirst
        muted
      />

      <FeatureSection
        id="ats-engine"
        badge="ATS Qualification"
        badgeVariant="success"
        title={<>Score &gt;90% before you apply. Never get screened out by robots.</>}
        intro="Over 75% of resumes are culled by automated applicant tracking filters before a human ever looks at them. Don't submit low-scoring resumes into the void."
        bullets={[
          { title: "Hard & Soft Skill Taxonomy", body: "Matched skills are underlined in emerald and missing keywords in rose, right in the posting." },
          { title: "Recruiter Searchability Check", body: "Verifies job title match, summary effectiveness, contact fields, section headings and standard date formatting." },
          { title: "Recruiter Tips", body: "Checks for measurable results, resume tone, web presence and word count, with the evidence quoted back." },
          { title: "Over-indexing Alerts", body: "Catches keyword stuffing before automated scanners flag your resume." },
        ]}
        shot={SHOTS.ats}
      />

      <FeatureSection
        id="authenticity"
        badge="AI Slop Detection"
        badgeVariant="warning"
        check="amber"
        title="Sound like a seasoned human leader, not a generic chatbot."
        intro="Recruiters and hiring managers have developed acute fatigue for generic ChatGPT prose. The Authenticity Engine scans your materials for dead giveaways so your own voice shines."
        bullets={[
          { title: "Probabilistic AI Signal Score", body: "Quantifies how closely your phrasing resembles default LLM output." },
          { title: "Negative Parallelism Detector", body: <>Flags repetitive tropes like <em>&quot;X, not Y&quot;</em> and <em>&quot;rather than&quot;</em> that recruiters instantly recognize.</> },
          { title: "Openers & Clause Rhythm", body: "Catches narrative opener flourishes and evenly balanced clause cadence, with the offending lines quoted." },
        ]}
        shot={SHOTS.slop}
        imageFirst
        muted
      />

      <FeatureSection
        id="rewriter"
        badge="Precision Rewriter"
        badgeVariant="purple"
        check="purple"
        title="Tailor in minutes with word-by-word visual diffs."
        intro="Forget maintaining a dozen separate Word documents. Generate a targeted resume with surgical word-level edits that bring in role-specific language while preserving your voice."
        bullets={[
          { title: "One-Click Inline Diffs", body: "Click a green suggestion to accept it or × to dismiss it, then Accept all or Reset to original." },
          { title: "Context-Aware Synthesis", body: "Drop in docs or paste notes alongside your candidate profile for grounded rewrites." },
          { title: "Apply Side by Side", body: "The employer's application opens in the left pane next to your tailored resume." },
          { title: "Print-Ready PDF Export", body: "Download a clean PDF, or save the result as a new resume." },
        ]}
        shot={SHOTS.rewriter}
      />

      <FeatureSection
        id="application"
        badge="Application Kit"
        badgeVariant="pink"
        check="pink"
        title="Cover letters that sound like you, and a record of what you sent."
        intro="Write the letter next to the live application, then keep the exact package you submitted with the job, so you're never guessing which version a recruiter is holding."
        bullets={[
          { title: "Grounded Cover Letters", body: "Generated from the posting and your resume, steered by a line on what interests you about the role, and never inventing experience." },
          { title: "Letter Header & PDF", body: "Contact details fill in from your resume; edit the draft, copy it, or download a PDF." },
          { title: "Submission Archive & Notes", body: "Save the application package you sent and log recruiter replies and interview notes per job." },
        ]}
        shot={SHOTS.coverLetter}
        imageFirst
        muted
      />

      <FeatureSection
        id="autofill"
        badge="Autofill"
        badgeVariant="green"
        title="Fill application forms in one click."
        intro="The same Chrome extension stores your application fields and drops them into the form you're looking at. No more retyping your LinkedIn URL for the hundredth time."
        bullets={[
          { title: "Fill Application Fields", body: "Name, contact details, current title and company, LinkedIn, website, work authorization and sponsorship." },
          { title: "Quick Copy", body: "Every saved field is listed in the panel for anything a form won't let the extension reach." },
          { title: "Set Once", body: "Edit the fields from your profile; the extension and the web app stay in sync." },
        ]}
        shot={SHOTS.fill}
      />

      {/* Bring your own AI + Claude MCP */}
      <section id="ai" className="border-t border-border/50 bg-muted/20 py-16 sm:py-24 scroll-mt-20">
        <div className="mx-auto max-w-6xl px-5 space-y-10">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <Badge variant="info" label="Your AI, Your Choice" />
            <h2 className="text-2xl sm:text-3xl font-bold text-primary tracking-tight">
              Bring your own model, or run your search from inside Claude.
            </h2>
            <p className="text-sm text-secondary leading-relaxed">
              Core scoring works without any AI at all. When you want generation, you pick the provider and keep the key.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <Screenshot shot={SHOTS.providers} />
              <h3 className="text-lg font-semibold text-primary">Connect Claude, Gemini, Grok or Mistral</h3>
              <p className="text-sm text-secondary leading-relaxed">
                Add one or more API keys and choose your active default. That provider powers cover letters, resume rewriting, AI fitness checks and smart parsing.
              </p>
            </div>
            <div className="space-y-4">
              <Screenshot shot={SHOTS.connector} />
              <h3 className="text-lg font-semibold text-primary">Work from Claude with the MCP connector</h3>
              <p className="text-sm text-secondary leading-relaxed">
                Add Job Search as a custom connector in claude.ai, the Claude apps or Claude Code. Claude can read your pipeline, resumes and profile, add and update jobs, and run ATS and fitness checks on your Claude plan, with no API key needed.
              </p>
              <code className="block overflow-x-auto rounded-md border border-border/60 bg-zinc-950/80 px-3 py-2 text-[11px] font-mono text-zinc-300">
                claude mcp add --transport http jobsearch https://jobs.fieldlines.org/api/mcp
              </code>
            </div>
          </div>
        </div>
      </section>

      {/* Everything else */}
      <section className="border-t border-border/50 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-5 space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-primary">And the details that save you hours</h2>
            <p className="text-sm text-secondary max-w-xl mx-auto">
              Small things that add up over a 200-application search.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <Screenshot shot={SHOTS.resumes} />
              <h3 className="text-lg font-semibold text-primary">Multiple resumes, tagged by where they went</h3>
              <p className="text-sm text-secondary leading-relaxed">
                Keep a resume per job type, upload PDFs or text, set a default, and see at a glance which companies each version has been used for.
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-center rounded-xl bg-muted p-6 sm:p-10 shadow-2xl shadow-black/20">
                <Image
                  src={SHOTS.importSheet.src}
                  alt={SHOTS.importSheet.alt}
                  width={SHOTS.importSheet.width}
                  height={SHOTS.importSheet.height}
                  sizes="(min-width: 1024px) 480px, 100vw"
                  className="w-full max-w-md h-auto block drop-shadow-2xl"
                />
              </div>
              <h3 className="text-lg font-semibold text-primary">Import from Google Sheets or CSV</h3>
              <p className="text-sm text-secondary leading-relaxed">
                Paste a shared spreadsheet link or upload a CSV and your existing search lands in the pipeline intact.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {MORE_FEATURES.map((f) => (
              <div key={f.title} className="p-5 rounded-xl border border-border bg-surface/80 space-y-2">
                <div className="font-semibold text-primary text-sm">{f.title}</div>
                <p className="text-xs text-secondary leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The 4 Strategic Pillars */}
      <section className="border-t border-border/50 bg-muted/30 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-5 text-center space-y-8">
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-primary">The Four Job Search Principles</h2>
            <p className="text-sm text-secondary max-w-xl mx-auto">
              Our platform is built around proven principles that help candidates secure high-paying, high-conviction roles.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
            <div className="p-5 rounded-xl border border-border bg-surface/80 space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/20 text-sky-400 text-xs font-bold">A</span>
                <span className="font-semibold text-primary text-sm">This is a numbers game</span>
              </div>
              <p className="text-xs text-secondary leading-relaxed">
                Apply to at least 5 jobs a day. No more. No less. 25 a week. Sustainable pacing prevents burnout and builds compounding interview pipeline.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-border bg-surface/80 space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">B</span>
                <span className="font-semibold text-primary text-sm">Tune your resume to &gt;90% match</span>
              </div>
              <p className="text-xs text-secondary leading-relaxed">
                Don&apos;t submit low score resumes. No one will ever see them. Tailor your resume until the ATS match passes 90% before you click apply.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-border bg-surface/80 space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">C</span>
                <span className="font-semibold text-primary text-sm">Practice first on low-stakes roles</span>
              </div>
              <p className="text-xs text-secondary leading-relaxed">
                Apply to jobs you don&apos;t love early on. Figure out your resume and your interview approach on them. Then apply to the ones that make you excited.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-border bg-surface/80 space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold">D</span>
                <span className="font-semibold text-primary text-sm">Get picky over time</span>
              </div>
              <p className="text-xs text-secondary leading-relaxed">
                Say yes to any interview or recruiter screen up front. Later, when you are well practiced and have a lay of the land, you can be selective.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="border-t border-border/50 py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-5 text-center">
          <div className="rounded-2xl border border-sky-500/30 bg-gradient-to-b from-sky-500/10 via-surface to-surface p-8 sm:p-12 shadow-2xl space-y-6">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-primary tracking-tight">
              Ready to take control of your career search?
            </h2>
            <p className="text-sm sm:text-base text-secondary max-w-xl mx-auto leading-relaxed">
              Sign in with your Google account and start qualifying roles, perfecting your match scores, and accelerating your interview pipeline today.
            </p>
            <div className="pt-2">
              <a href="/api/auth/login">
                <Button
                  label="Sign in with Google"
                  icon={<GoogleIcon />}
                  size="lg"
                  variant="primary"
                  className="px-8 py-3.5 text-base font-semibold shadow-lg shadow-sky-500/25"
                />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 text-center text-xs text-secondary">
        <div className="mx-auto max-w-6xl px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>© {new Date().getFullYear()} Job Search — Resume Match Engine. All rights reserved.</div>
          <div className="flex items-center gap-4">
            <a href="/chrome-extension.zip" download className="hover:text-primary transition-colors">
              Download Chrome Extension
            </a>
            <span>·</span>
            <a href="/api/auth/login" className="hover:text-primary transition-colors">
              Sign in
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
