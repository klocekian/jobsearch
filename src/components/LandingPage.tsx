import Image from "next/image";
import { Button } from "@astryxdesign/core/Button";
import { Badge } from "@astryxdesign/core/Badge";

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" className="shrink-0">
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
    <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
  </svg>
);

function BrowserFrame({
  url,
  children,
  className = "",
}: {
  url: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-xl border border-border/80 bg-zinc-950/80 shadow-2xl shadow-black/60 ring-1 ring-white/10 ${className}`}>
      {/* Chrome bar */}
      <div className="flex items-center gap-2 border-b border-border/60 bg-zinc-900/90 px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
        </div>
        <div className="mx-auto flex h-6 w-full max-w-sm items-center justify-center rounded-md bg-zinc-950/80 px-3 text-[11px] font-mono text-zinc-400 border border-border/40">
          <span className="truncate">{url}</span>
        </div>
      </div>
      <div className="relative bg-zinc-950">
        {children}
      </div>
    </div>
  );
}

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
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3.5 py-1 text-xs font-medium text-sky-300">
            <span className="flex h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
            Executive Career Command Center
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-[1.1]">
            Stop applying blindly into the void.{" "}
            <span className="bg-gradient-to-r from-sky-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
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
            <a href="#pipeline" className="w-full sm:w-auto">
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
              <div className="text-lg font-bold text-white">90%+</div>
              <div className="text-xs text-secondary">ATS match threshold</div>
            </div>
            <div className="p-3 rounded-lg border border-border/40 bg-muted/40">
              <div className="text-lg font-bold text-white">5 Roles/Day</div>
              <div className="text-xs text-secondary">Intentional daily pacing</div>
            </div>
            <div className="p-3 rounded-lg border border-border/40 bg-muted/40">
              <div className="text-lg font-bold text-white">AI Slop 0%</div>
              <div className="text-xs text-secondary">Authenticity verification</div>
            </div>
            <div className="p-3 rounded-lg border border-border/40 bg-muted/40">
              <div className="text-lg font-bold text-white">Live Diffs</div>
              <div className="text-xs text-secondary">In-place resume tailoring</div>
            </div>
          </div>
        </div>

        {/* Hero Shot 1: Pipeline Command Center */}
        <div id="pipeline" className="mt-14 scroll-mt-20">
          <BrowserFrame url="https://jobs.fieldlines.org/jobs">
            <Image
              src="/hero/pipeline-dashboard.png"
              alt="Application Pipeline & Analytics Dashboard"
              width={1024}
              height={562}
              className="w-full h-auto block"
              priority
            />
          </BrowserFrame>
        </div>
      </section>

      {/* Feature 1: The Pipeline & Numbers Game */}
      <section className="border-t border-border/50 bg-muted/20 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-5 space-y-4">
              <Badge variant="blue" label="Funnel Intelligence" />
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Turn your job search into a predictable numbers game.
              </h2>
              <p className="text-sm text-secondary leading-relaxed">
                Job searching is stressful when you don&apos;t know where you stand. Our visual pipeline models your entire lifecycle from initial bookmark to signed offer, helping you pace applications and uncover conversion bottlenecks.
              </p>
              <ul className="space-y-3 pt-2 text-xs sm:text-sm text-primary">
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                  <span><strong>Full Conversion Funnel</strong>: Track Saved → Applying → Applied → Recruiter Screen → Interview → Onsite → Offer.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                  <span><strong>Drop-off Diagnostics</strong>: Clearly distinguish between rejections, expired postings, and intentional abandonments.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                  <span><strong>Adaptive Strategy Coaching</strong>: Built-in guidance nudges you: apply to 5 jobs a day, 25 a week, and calibrate selectivity as interviews ramp.</span>
                </li>
              </ul>
            </div>
            <div className="lg:col-span-7">
              <BrowserFrame url="jobs.fieldlines.org/jobs (Pipeline Funnel & Pacing)">
                <Image
                  src="/hero/pipeline-dashboard.png"
                  alt="Application Pipeline Stages"
                  width={1024}
                  height={562}
                  className="w-full h-auto block"
                />
              </BrowserFrame>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 2: 90%+ ATS Pass & Qualification Engine */}
      <section id="ats-engine" className="border-t border-border/50 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 order-2 lg:order-1">
              <BrowserFrame url="jobs.fieldlines.org/jobs/378 (ATS Match 94/100)">
                <Image
                  src="/hero/ats-qualification.png"
                  alt="Precision ATS Qualification & Searchability Engine"
                  width={1024}
                  height={562}
                  className="w-full h-auto block"
                />
              </BrowserFrame>
            </div>
            <div className="lg:col-span-5 order-1 lg:order-2 space-y-4">
              <Badge variant="success" label="ATS Qualification" />
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Score &gt;90% before you apply. Never get screened out by robots.
              </h2>
              <p className="text-sm text-secondary leading-relaxed">
                Over 75% of resumes are culled by automated applicant tracking filters before a human ever looks at them. Don&apos;t submit low-scoring resumes into the void.
              </p>
              <ul className="space-y-3 pt-2 text-xs sm:text-sm text-primary">
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                  <span><strong>Hard &amp; Soft Skill Taxonomy</strong>: Color-coded live markup identifies matched skills in emerald and missing keywords in rose.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                  <span><strong>Recruiter Searchability Check</strong>: Verifies job title match, summary effectiveness, contact fields, and standard date formatting.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                  <span><strong>Over-indexing Alerts</strong>: Catches keyword stuffing before automated scanners flag your resume.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 3: AI Slop & Authenticity Detection */}
      <section id="authenticity" className="border-t border-border/50 bg-muted/20 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-5 space-y-4">
              <Badge variant="warning" label="AI Slop Detection" />
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Sound like a seasoned human leader, not a generic chatbot.
              </h2>
              <p className="text-sm text-secondary leading-relaxed">
                Recruiters and hiring managers have developed acute fatigue for generic ChatGPT prose. Our Authenticity Engine scans your materials for dead giveaways so your authentic craft shines.
              </p>
              <ul className="space-y-3 pt-2 text-xs sm:text-sm text-primary">
                <li className="flex items-start gap-2.5">
                  <span className="text-amber-400 font-bold mt-0.5">✓</span>
                  <span><strong>Probabilistic AI Signal Score</strong>: Quantifies how closely your phrasing resembles default LLM outputs.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-amber-400 font-bold mt-0.5">✓</span>
                  <span><strong>Negative Parallelism Detector</strong>: Flags repetitive tropes like <em>&quot;not only X, but also Y&quot;</em> that recruiters instantly recognize.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-amber-400 font-bold mt-0.5">✓</span>
                  <span><strong>Cadence &amp; Rule-of-Three Analysis</strong>: Eliminates robotic triads and filler openers that dilute your actual achievements.</span>
                </li>
              </ul>
            </div>
            <div className="lg:col-span-7">
              <BrowserFrame url="jobs.fieldlines.org/jobs/261 (Authenticity Check)">
                <Image
                  src="/hero/ai-authenticity.png"
                  alt="AI Slop & Authenticity Detection Engine"
                  width={1024}
                  height={562}
                  className="w-full h-auto block"
                />
              </BrowserFrame>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 4: Surgical In-Place Resume Rewriter */}
      <section id="rewriter" className="border-t border-border/50 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 order-2 lg:order-1">
              <BrowserFrame url="jobs.fieldlines.org/jobs/261 (Tailored Diff Rewriter)">
                <Image
                  src="/hero/tailored-rewriter.png"
                  alt="Tailored In-Place Resume Rewriter with Live Diffs"
                  width={1024}
                  height={562}
                  className="w-full h-auto block"
                />
              </BrowserFrame>
            </div>
            <div className="lg:col-span-5 order-1 lg:order-2 space-y-4">
              <Badge variant="purple" label="Precision Rewriter" />
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Tailor in minutes with word-by-word visual diffs.
              </h2>
              <p className="text-sm text-secondary leading-relaxed">
                Forget maintaining dozen of separate Word documents. Generate targeted resumes in seconds with surgical word-level edits that incorporate role-specific language while preserving your voice.
              </p>
              <ul className="space-y-3 pt-2 text-xs sm:text-sm text-primary">
                <li className="flex items-start gap-2.5">
                  <span className="text-purple-400 font-bold mt-0.5">✓</span>
                  <span><strong>One-Click Inline Diffs</strong>: Green insertions and red strike-throughs let you accept or reject individual phrasing suggestions.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-purple-400 font-bold mt-0.5">✓</span>
                  <span><strong>Context-Aware Synthesis</strong>: Ingests your brag sheet, candidate profile, and portfolio notes for grounded rewrites.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-purple-400 font-bold mt-0.5">✓</span>
                  <span><strong>Print-Ready PDF Export</strong>: Download clean, ATS-parsed PDFs formatted for standard recruiter submission systems.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* The 4 Strategic Pillars */}
      <section className="border-t border-border/50 bg-muted/30 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-5 text-center space-y-8">
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">The Four Job Search Principles</h2>
            <p className="text-sm text-secondary max-w-xl mx-auto">
              Our platform is built around proven principles that help candidates secure high-paying, high-conviction roles.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
            <div className="p-5 rounded-xl border border-border bg-surface/80 space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/20 text-sky-400 text-xs font-bold">A</span>
                <span className="font-semibold text-white text-sm">This is a numbers game</span>
              </div>
              <p className="text-xs text-secondary leading-relaxed">
                Apply to at least 5 jobs a day. No more. No less. 25 a week. Sustainable pacing prevents burnout and builds compounding interview pipeline.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-border bg-surface/80 space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">B</span>
                <span className="font-semibold text-white text-sm">Tune your resume to &gt;90% match</span>
              </div>
              <p className="text-xs text-secondary leading-relaxed">
                Don&apos;t submit low score resumes. No one will ever see them. Tailor your resume until the ATS match passes 90% before you click apply.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-border bg-surface/80 space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">C</span>
                <span className="font-semibold text-white text-sm">Practice first on low-stakes roles</span>
              </div>
              <p className="text-xs text-secondary leading-relaxed">
                Apply to jobs you don&apos;t love early on. Figure out your resume and your interview approach on them. Then apply to the ones that make you excited.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-border bg-surface/80 space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold">D</span>
                <span className="font-semibold text-white text-sm">Get picky over time</span>
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
          <div className="rounded-2xl border border-sky-500/30 bg-gradient-to-b from-sky-950/40 via-surface to-surface p-8 sm:p-12 shadow-2xl space-y-6">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
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
