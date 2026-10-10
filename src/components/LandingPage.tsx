import Image, { getImageProps } from "next/image";
import { Button } from "@astryxdesign/core/Button";
import { Badge, type BadgeVariant } from "@astryxdesign/core/Badge";
import { TipIcon } from "@/components/icons";

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
    <div className={`overflow-hidden rounded-2xl bg-zinc-950/80 shadow-2xl shadow-black/60 ${className}`}>
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

type Img = { src: string; width: number; height: number };
type Shot = Img & { alt: string; mobile?: Img };

// Phones get a tighter crop of the part each shot is about; tapping opens the full image.
// `fill` pins the frame to a fixed aspect ratio so side-by-side shots line up.
function Screenshot({ shot, priority, fill }: { shot: Shot; priority?: boolean; fill?: string }) {
  const sizes = "(min-width: 1024px) 680px, 100vw";
  const { props: { srcSet: desktopSrcSet } } = getImageProps({ src: shot.src, alt: shot.alt, width: shot.width, height: shot.height, sizes });
  const base = fill ? shot : shot.mobile ?? shot;
  const { props: img } = getImageProps({
    src: base.src,
    width: base.width,
    height: base.height,
    alt: shot.alt,
    sizes,
    loading: priority ? "eager" : "lazy",
    fetchPriority: priority ? "high" : undefined,
  });
  return (
    <BrowserFrame>
      <a href={shot.src} target="_blank" rel="noopener" aria-label={`Open full screenshot: ${shot.alt}`} className={`block ${fill ?? ""}`}>
        <picture>
          {shot.mobile && !fill && <source media="(min-width: 640px)" srcSet={desktopSrcSet} sizes={sizes} />}
          {/* eslint-disable-next-line jsx-a11y/alt-text -- alt comes from getImageProps */}
          <img {...img} className={fill ? "h-full w-full object-cover object-left-top" : "w-full h-auto block"} />
        </picture>
      </a>
    </BrowserFrame>
  );
}

const CHECK_COLORS = {
  emerald: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  purple: "text-purple-600 dark:text-purple-400",
  sky: "text-sky-600 dark:text-sky-400",
  teal: "text-teal-600 dark:text-teal-400",
  orange: "text-orange-600 dark:text-orange-400",
  pink: "text-pink-600 dark:text-pink-400",
  cyan: "text-cyan-600 dark:text-cyan-400",
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
  note,
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
  note?: React.ReactNode;
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
            <ul className="space-y-3 pt-2 text-sm text-primary">
              {bullets.map((b) => (
                <li key={b.title} className="flex items-start gap-2.5">
                  <span className={`${CHECK_COLORS[check]} font-bold mt-0.5`}>✓</span>
                  <span><strong>{b.title}.</strong> {b.body}</span>
                </li>
              ))}
            </ul>
            {note && <p className="text-xs text-secondary leading-relaxed">{note}</p>}
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
  dashboard: { src: "/hero/pipeline-dashboard.webp", alt: "Job search dashboard showing saved roles, application stages, and fit and resume-match scores.", width: 2400, height: 1178, mobile: { src: "/hero/pipeline-dashboard-mobile.webp", width: 1200, height: 360 } },
  drilldown: { src: "/hero/pipeline-drilldown.webp", alt: "Applications at the recruiter stage, with each role's progress through earlier stages.", width: 1896, height: 981, mobile: { src: "/hero/pipeline-drilldown-mobile.webp", width: 1200, height: 934 } },
  clip: { src: "/hero/extension-clip.webp", alt: "Chrome side panel capturing a job's company, title, salary, and description from a careers page.", width: 2400, height: 1182, mobile: { src: "/hero/extension-clip-mobile.webp", width: 656, height: 1170 } },
  fitness: { src: "/hero/fitness-check.webp", alt: "Role-fit review with a 1–10 score and an explanation of how the candidate's experience relates to each requirement.", width: 2400, height: 1178, mobile: { src: "/hero/fitness-check-mobile.webp", width: 1200, height: 630 } },
  profile: { src: "/hero/candidate-profile.webp", alt: "Candidate profile containing experience and accomplishments, alongside gaps and context for future applications.", width: 1772, height: 1844, mobile: { src: "/hero/candidate-profile-mobile.webp", width: 1200, height: 749 } },
  ats: { src: "/hero/ats-qualification.webp", alt: "Resume-match review showing a score, highlighted skills, and checks for clear structure and searchable information.", width: 2400, height: 1178, mobile: { src: "/hero/ats-qualification-mobile.webp", width: 1200, height: 758 } },
  slop: { src: "/hero/ai-authenticity.webp", alt: "Writing review highlighting formulaic phrases, elaborate openings, and repeated sentence patterns in a resume.", width: 1685, height: 1034 },
  rewriter: { src: "/hero/tailored-rewriter.webp", alt: "Tailored resume with individual changes available to accept or dismiss beside the employer's application form.", width: 2400, height: 1178, mobile: { src: "/hero/tailored-rewriter-mobile.webp", width: 1200, height: 758 } },
  coverLetter: { src: "/hero/cover-letter.webp", alt: "Editable cover letter with contact details beside an employer's application form.", width: 2400, height: 1178, mobile: { src: "/hero/cover-letter-mobile.webp", width: 1200, height: 758 } },
  fill: { src: "/hero/extension-fill.webp", alt: "Chrome extension filling saved application details into an employer's application form.", width: 2400, height: 1182, mobile: { src: "/hero/extension-fill-mobile.webp", width: 656, height: 1350 } },
  providers: { src: "/hero/ai-providers.webp", alt: "AI settings with options to connect Anthropic Claude, Google Gemini, xAI Grok, and Mistral AI.", width: 1800, height: 1566 },
  connector: { src: "/hero/claude-connector.webp", alt: "Job Search connected to Claude, with tools for reading and updating applications, profiles, and resumes.", width: 1840, height: 1436 },
  importSheet: { src: "/hero/import-sheet.webp", alt: "Job import options for a Google Sheet link or CSV upload.", width: 968, height: 728 },
  resumes: { src: "/hero/resumes.webp", alt: "Saved resumes with tags showing the companies each version was used for.", width: 1728, height: 1560 },
} satisfies Record<string, Shot>;

const HIGHLIGHTS = [
  { title: "Understand your fit", body: "See where your experience connects to a role." },
  { title: "Make your experience clear", body: "Check your resume against the posting." },
  { title: "Keep your own voice", body: "Review wording that feels generic or overstated." },
  { title: "Spend less time repeating yourself", body: "Save postings and fill application fields with the Chrome extension." },
];

const STEPS = [
  { n: "1", title: "Save the role", body: "Clip a posting with the Chrome extension, paste a link, or bring in the jobs you've already collected in a spreadsheet.", color: "bg-sky-500/20 text-sky-800 dark:text-sky-300" },
  { n: "2", title: "Understand your fit", body: "Compare the requirements with your experience. See your strengths, the connections you may need to explain, and the gaps to consider before applying.", color: "bg-teal-500/20 text-teal-800 dark:text-teal-300" },
  { n: "3", title: "Make your case", body: "Tailor your resume and draft a cover letter around the role. Review the changes and decide what sounds right to you.", color: "bg-purple-500/20 text-purple-800 dark:text-purple-300" },
  { n: "4", title: "Keep track", body: "Save what you sent, record conversations, and follow each application through to its outcome.", color: "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300" },
];

const MORE_FEATURES = [
  { title: "Save from a link or pasted text", body: "Add a posting by URL or paste its description. Extract the company, title, location, and salary into the saved role." },
  { title: "See which postings have closed", body: "Recheck your active postings in one step and mark the roles an employer has taken down." },
  { title: "Record how each application ended", body: "Use thirteen statuses to track progress and outcomes, including accepted offers, rejections, withdrawals, declined opportunities, and closed postings." },
  { title: "Get your bearings with a short tour", body: "A six-step walkthrough introduces saving jobs, building your profile, reviewing fit, tailoring applications, and tracking progress. Return to it whenever you need a refresher." },
];

const PRINCIPLES = [
  { icon: "clock" as const, title: "Find a pace you can keep", body: "Set a realistic rhythm for finding roles, applying, and following up. Leave room for research and interview preparation, and adjust as your circumstances change.", color: "bg-sky-500/20 text-sky-800 dark:text-sky-300" },
  { icon: "link" as const, title: "Make the connection clear", body: "Help the reader see why your experience matters for this role. Use relevant language from the posting where it accurately describes your work, and support it with specific examples.", color: "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300" },
  { icon: "lightbulb" as const, title: "Learn as you go", body: "Notice which applications lead to conversations and which questions come up in interviews. Use those experiences to refine your materials and get more comfortable explaining your work.", color: "bg-amber-500/20 text-amber-800 dark:text-amber-300" },
  { icon: "compass" as const, title: "Let your priorities become clearer", body: "Talking with teams can change what you're looking for. Revisit your priorities as you learn, and put more of your attention toward work and working conditions that fit you.", color: "bg-purple-500/20 text-purple-800 dark:text-purple-300" },
];

export function LandingPage() {
  return (
    <div className="relative min-h-screen bg-surface text-primary selection:bg-sky-500/30 selection:text-sky-950 dark:selection:text-sky-100">
      {/* Background radial gradient glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[600px] overflow-hidden">
        <div className="absolute left-1/2 -top-24 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-b from-sky-500/15 via-emerald-500/10 to-transparent blur-3xl" />
      </div>

      {/* Hero Section */}
      <section className="mx-auto max-w-6xl px-5 pt-12 pb-16 sm:pt-20 sm:pb-24">
        <div className="text-center space-y-6 max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-primary leading-[1.1] text-balance">
            <span className="block">Find work you want.</span>
            <span className="block mt-1 bg-gradient-to-r from-sky-600 via-teal-600 to-emerald-600 dark:from-sky-400 dark:via-teal-300 dark:to-emerald-400 bg-clip-text text-transparent">
              Make a clearer case for yourself.
            </span>
          </h1>

          <div className="space-y-3">
            <p className="text-base sm:text-lg text-secondary leading-relaxed">
              You find an interesting role. Then come the questions: Does my experience fit? What should I emphasize? Which resume did I send last time?
            </p>
            <p className="text-base sm:text-lg text-secondary leading-relaxed">
              Job Search brings those pieces together. Save roles, work through the requirements, tailor your application using what you&apos;ve actually done, and keep track of what happens next.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
            <a href="/api/auth/login" className="w-full sm:w-auto">
              <Button
                label="Start with Google"
                icon={<GoogleIcon />}
                size="lg"
                variant="primary"
                className="w-full sm:w-auto px-6 py-3 font-semibold shadow-lg shadow-sky-500/20"
              />
            </a>
            <a href="#how-it-works" className="w-full sm:w-auto">
              <Button
                label="See how it works"
                size="lg"
                variant="secondary"
                className="w-full sm:w-auto"
              />
            </a>
          </div>

          {/* Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-8 border-t border-border/50 text-left">
            {HIGHLIGHTS.map((h) => (
              <div key={h.title} className="p-3 rounded-lg border border-border/40 bg-muted/40">
                <div className="text-sm font-semibold text-primary">{h.title}</div>
                <div className="mt-1 text-xs text-secondary leading-snug">{h.body}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Hero Shot */}
        <div id="pipeline" className="mt-14 scroll-mt-20">
          <Screenshot shot={SHOTS.dashboard} priority />
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t border-border/50 bg-muted/30 py-16 sm:py-20 scroll-mt-20">
        <div className="mx-auto max-w-5xl px-5 text-center space-y-8">
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-primary text-balance">From an interesting role to an application you feel ready to send</h2>
            <p className="text-sm text-secondary max-w-xl mx-auto">
              Keep the research, writing, and follow-up together, so each application is easier to pick up where you left off.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
            {STEPS.map((s) => (
              <div key={s.n} className="p-5 rounded-2xl border border-border bg-surface/80 space-y-2">
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
        badge="Save jobs as you find them"
        badgeVariant="cyan"
        check="cyan"
        title="Found an interesting role? Keep it in one click."
        intro="When you're browsing a job board or a company careers page, save the posting from Chrome's side panel. The role and its description stay together, ready for you to review when you have time."
        bullets={[
          { title: "Keep the details together", body: "Capture the company, title, location, remote policy, salary, and full description. If a page is difficult to read, try extracting it again with AI." },
          { title: "See what you've already saved", body: "Duplicate postings are flagged with their current status, and your recent saves are easy to find." },
          { title: "Bring your existing search", body: "Import jobs from a Google Sheet or CSV file." },
        ]}
        shot={SHOTS.clip}
        footer={
          <>
            <p className="pt-2 text-xs text-secondary sm:hidden">Works in desktop Chrome. Open this page on your computer to install it.</p>
            <a href="/chrome-extension.zip" download className="hidden sm:inline-block pt-2 text-xs font-semibold text-cyan-700 hover:text-cyan-800 dark:text-cyan-300 dark:hover:text-cyan-200 transition-colors">
              Download the Chrome extension →
            </a>
          </>
        }
      />

      <FeatureSection
        id="track"
        badge="Know where things stand"
        badgeVariant="blue"
        title="See what's moving, what's waiting, and where to follow up."
        intro="A job search can feel hard to read when applications and conversations are scattered. See them together, from the first saved posting to an offer, and get a clearer view of how your search is going."
        bullets={[
          { title: "Follow every stage", body: "Track roles through Saved, Applying, Applied, Recruiter Screen, Interview, Onsite, and Offer." },
          { title: "Look closer when you need to", body: "Open any stage to see the roles there and how each one arrived." },
          { title: "Understand how applications ended", body: "Keep rejections, closed postings, and roles you chose to leave behind distinct." },
          { title: "Find a pace you can sustain", body: "Get prompts to keep your search moving and reconsider your focus as interviews begin to fill your calendar." },
        ]}
        shot={SHOTS.drilldown}
        imageFirst
        muted
      />

      <FeatureSection
        id="fitness"
        badge="Is this role worth pursuing?"
        badgeVariant="teal"
        check="teal"
        title="Understand the fit before you spend an evening on the application."
        intro="Some roles look promising until you read the requirements closely. Others are a better fit than their title suggests. Compare each posting with your profile, requirement by requirement, with a 1–10 score to help you get your bearings."
        bullets={[
          { title: "See the reasoning", body: "Review the minimum and preferred qualifications you meet, the ones your experience is adjacent to, and the ones you don't currently meet. Personality and working-style expectations are shown separately and don't affect the score." },
          { title: "Prepare to discuss the gaps", body: "Get suggested ways to explain relevant experience and acknowledge what you still need to learn before a recruiter conversation." },
          { title: "Consider the trade-offs", body: "Explore possible outcomes and what pursuing the role could mean for you." },
          { title: "Choose how to assess it", body: "Start with the built-in rules, or add an AI review for a more detailed interpretation." },
        ]}
        note="The score is a starting point for your judgment. Your interest in the work, transferable experience, and conversations with the team still matter."
        shot={SHOTS.fitness}
      />

      <FeatureSection
        id="profile"
        badge="Start with your experience"
        badgeVariant="orange"
        check="orange"
        title="Tell your story once. Build each application from there."
        intro="Keep a profile of your experience, accomplishments, and skills, along with the gaps or constraints you want to address honestly. Fit reviews, resume suggestions, and cover letters use that profile as their starting point."
        bullets={[
          { title: "Keep the facts close", body: "Record the results, responsibilities, and tools you can speak to from experience." },
          { title: "Be clear about the gaps", body: "Note tools you haven't used, requirements you don't meet, or working arrangements that need discussion. Add context you'd like future drafts to consider." },
          { title: "Get started with examples", body: "Download the profile and gaps templates, then fill them in with your own experience." },
        ]}
        note="Review every draft before sending it, so each claim reflects what you've actually done."
        shot={SHOTS.profile}
        imageFirst
        muted
      />

      <FeatureSection
        id="ats-engine"
        badge="Help your experience come through"
        badgeVariant="success"
        title="Check whether your resume makes the connection clear."
        intro="You may have the experience a role needs without describing it in the language the posting uses. Compare your resume with the job description to find relevant skills you haven't made clear and details that could be easier to read or search."
        bullets={[
          { title: "Compare the language", body: "See the skills your resume already mentions and the relevant terms you may want to include, highlighted directly in the posting." },
          { title: "Check the basics", body: "Review your job titles, summary, contact information, section headings, and date formatting." },
          { title: "Make your evidence easier to find", body: "Get feedback on results, tone, length, and professional links, with the relevant passages shown alongside it." },
          { title: "Keep it readable", body: "Spot repeated keywords and language that feels forced." },
        ]}
        note="Use the match score to guide your edits. It reflects this tool's comparison with the posting; it doesn't predict an employer's screening decision."
        shot={SHOTS.ats}
      />

      <FeatureSection
        id="authenticity"
        badge="Keep your own voice"
        badgeVariant="warning"
        check="amber"
        title="Send something you'd feel comfortable saying out loud."
        intro="AI can help you get a draft started. It can also make your experience sound like everyone else's. Review stock phrases, repetitive sentence patterns, and wording that could be more direct or specific."
        bullets={[
          { title: "Find generic wording", body: "See passages that resemble common AI writing patterns and decide whether they need another pass." },
          { title: "Notice repeated formulas", body: "Catch recurring contrast structures that make the writing feel templated." },
          { title: "Read for rhythm", body: "Review elaborate openings and sentences that all follow the same cadence, with the passages highlighted for you." },
        ]}
        note="The writing score flags patterns to review. It doesn't establish who wrote the text or how a recruiter will respond."
        shot={SHOTS.slop}
        imageFirst
        muted
      />

      <FeatureSection
        id="rewriter"
        badge="Bring the relevant experience forward"
        badgeVariant="purple"
        check="purple"
        title="Tailor your resume without starting over."
        intro="Use the posting, your profile, and any supporting notes to draft a version for this role. See exactly which words changed, then keep the edits that help you tell your story clearly."
        bullets={[
          { title: "Review each change", body: "Accept or dismiss suggestions individually, accept them together, or return to the original." },
          { title: "Add useful context", body: "Include documents or notes with the details you want the rewrite to draw from." },
          { title: "Work beside the application", body: "Open the employer's form alongside your tailored resume to keep both in view." },
          { title: "Save a version you're ready to send", body: "Download a PDF or keep the rewrite as another resume in your account." },
        ]}
        shot={SHOTS.rewriter}
      />

      <FeatureSection
        id="application"
        badge="Make it personal. Keep a copy."
        badgeVariant="pink"
        check="pink"
        title="Explain why you're interested, and remember what you sent."
        intro="Start a cover letter with the role, your experience, and a few words about what draws you to the opportunity. Edit it beside the application, then save the final package with the job so you can return to it before a conversation."
        bullets={[
          { title: "Give the draft a reason to exist", body: "Add what interests you about the role so the letter can connect that interest to your experience." },
          { title: "Finish it in one place", body: "Bring in contact details from your resume, edit the letter, and copy it or download a PDF." },
          { title: "Keep the conversation together", body: "Save your submitted materials, recruiter replies, and interview notes with the role." },
        ]}
        shot={SHOTS.coverLetter}
        imageFirst
        muted
      />

      <FeatureSection
        id="autofill"
        badge="Less retyping"
        badgeVariant="green"
        title="Your LinkedIn URL hasn't changed since the last application."
        intro="Save the details you use repeatedly and let the Chrome extension fill them into application forms. Keep them available to copy when a form needs a little more help."
        bullets={[
          { title: "Fill the recurring fields", body: "Reuse your name, contact details, current title and company, LinkedIn, website, work authorization, and sponsorship information." },
          { title: "Copy what a form won't accept", body: "Find every saved field in the side panel for quick copying." },
          { title: "Update your details in one place", body: "Changes to your profile stay in sync between the web app and extension." },
        ]}
        shot={SHOTS.fill}
      />

      {/* AI options + Claude connector */}
      <section id="ai" className="border-t border-border/50 bg-muted/20 py-16 sm:py-24 scroll-mt-20">
        <div className="mx-auto max-w-6xl px-5 space-y-10">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <Badge variant="info" label="Work with the tools you prefer" />
            <h2 className="text-2xl sm:text-3xl font-bold text-primary tracking-tight text-balance">
              Use AI when it helps. Choose how it fits into your search.
            </h2>
            <p className="text-sm text-secondary leading-relaxed">
              The built-in scoring works without AI. For drafting, rewriting, and deeper reviews, connect a supported provider with your own API key or work through the Claude connector.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <Screenshot shot={SHOTS.providers} fill="aspect-[5/4]" />
              <h3 className="text-lg font-semibold text-primary">Connect your preferred AI provider</h3>
              <p className="text-sm text-secondary leading-relaxed">
                Add an API key for Claude, Gemini, Grok, or Mistral and choose the provider you want to use. It can help draft cover letters, tailor resumes, review role fit, and extract details from postings.
              </p>
            </div>
            <div className="space-y-4">
              <Screenshot shot={SHOTS.connector} fill="aspect-[5/4]" />
              <h3 className="text-lg font-semibold text-primary">Keep working from Claude</h3>
              <p className="text-sm text-secondary leading-relaxed">
                Connect Job Search to claude.ai, the Claude apps, or Claude Code. Ask Claude to review your pipeline, work with your resumes and profile, add or update jobs, and run resume-match and role-fit checks.
              </p>
              <p className="text-sm text-secondary leading-relaxed">
                The connector uses your Claude plan, with no separate API key needed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Additional features */}
      <section className="border-t border-border/50 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-5 space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-primary text-balance">The small details that make it easier to keep going</h2>
            <p className="text-sm text-secondary max-w-xl mx-auto">
              As your search grows, keep the versions, notes, and loose ends easy to find.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <Screenshot shot={SHOTS.resumes} fill="aspect-[5/4]" />
              <h3 className="text-lg font-semibold text-primary">Keep different resumes for different kinds of work</h3>
              <p className="text-sm text-secondary leading-relaxed">
                Upload resumes as PDFs or text, choose a default, and see which companies received each version.
              </p>
            </div>
            <div className="space-y-4">
              <BrowserFrame>
                <div className="flex aspect-[5/4] items-center justify-center bg-zinc-200 p-6 sm:p-10">
                  <Image
                    src={SHOTS.importSheet.src}
                    alt={SHOTS.importSheet.alt}
                    width={SHOTS.importSheet.width}
                    height={SHOTS.importSheet.height}
                    sizes="(min-width: 1024px) 480px, 100vw"
                    className="w-full max-w-md h-auto block drop-shadow-xl"
                  />
                </div>
              </BrowserFrame>
              <h3 className="text-lg font-semibold text-primary">Bring your spreadsheet with you</h3>
              <p className="text-sm text-secondary leading-relaxed">
                Import jobs from a shared Google Sheet or CSV file and continue your search here.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {MORE_FEATURES.map((f) => (
              <div key={f.title} className="p-5 rounded-2xl border border-border bg-surface/80 space-y-2">
                <div className="font-semibold text-primary text-sm">{f.title}</div>
                <p className="text-xs text-secondary leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Principles */}
      <section className="border-t border-border/50 bg-muted/30 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-5 text-center space-y-8">
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-primary text-balance">A few ways to make the search more manageable</h2>
            <p className="text-sm text-secondary max-w-xl mx-auto">
              A job search takes time and energy. These principles can help you decide where to spend both.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
            {PRINCIPLES.map((pr) => (
              <div key={pr.title} className="p-5 rounded-2xl border border-border bg-surface/80 space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full ${pr.color}`}><TipIcon name={pr.icon} /></span>
                  <span className="font-semibold text-primary text-sm">{pr.title}</span>
                </div>
                <p className="text-xs text-secondary leading-relaxed">{pr.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="border-t border-border/50 py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-5 text-center">
          <div className="rounded-2xl border border-sky-500/30 bg-gradient-to-b from-sky-500/10 via-surface to-surface p-8 sm:p-12 shadow-2xl space-y-6">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-primary tracking-tight">
              Start with one role you&apos;re interested in.
            </h2>
            <p className="text-sm sm:text-base text-secondary max-w-xl mx-auto leading-relaxed">
              Save the posting, add your experience, and see how the two connect. Build the rest of your search from there.
            </p>
            <div className="pt-2">
              <a href="/api/auth/login">
                <Button
                  label="Start with Google"
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
          <div>© {new Date().getFullYear()} Job Search by Fieldlines. All rights reserved.</div>
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
