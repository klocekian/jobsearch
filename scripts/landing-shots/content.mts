// Synthetic demo content for the landing-page screenshots. Every person,
// company, and posting here is fictional.

export const PERSON = {
  first: "Jordan",
  last: "Avery",
  name: "Jordan Avery",
  email: "jordan.avery@example.com",
  phone: "(503) 555-0148",
  city: "Portland",
  state: "Oregon",
  location: "Portland, Oregon",
  linkedin: "https://www.linkedin.com/in/jordanavery-example/",
  website: "https://jordanavery.example.com",
  title: "Lead Product Designer",
  company: "Copperline Finance",
};

export const RESUME = `Jordan Avery
Lead Product Designer | AI-Assisted Workflows | Design Systems
Portland, Oregon · (503) 555-0148 · jordan.avery@example.com · linkedin.com/in/jordanavery-example

Summary
Product designer with 13 years of experience turning complex, high-stakes workflows into products people trust. I design not just screens, but the systems behind them: the patterns, research practice, and design systems that let teams ship with confidence. Watching a rough prototype become something a finance team relies on every morning is the part of this work I look forward to most.

Experience

Lead Product Designer, Copperline Finance · Portland, OR (remote) · March 2021 – Present
- Led design for Ledger Assist, an AI assistant that drafts journal entries and flags anomalies, cutting time-to-close by 38% for 4,000 customer finance teams.
- Built and lead a team of 5 product designers and 1 UX researcher, owning hiring, critique, and career ladders rather than leaving growth to chance.
- Created Penny, a cross-platform design system in Figma and React adopted by 9 product teams, reducing UI defects by 30%.
- Partnered with product management and engineering leadership on roadmap, prototyping, and usability testing, rather than handing off static specs.
- Introduced human-in-the-loop review patterns (confidence indicators, editable suggestions, audit trails) that raised AI suggestion acceptance from 41% to 67%.
- Designed payment approval and vendor payout flows used to move $2B a year, working closely with risk and compliance.

Senior Product Designer, Harborview Health · Seattle, WA · June 2017 – February 2021
- Owned end-to-end design for patient scheduling across iOS, Android, and web, serving 1.2M monthly active users.
- Led accessibility remediation to WCAG 2.1 AA across 140 screens, treating accessibility as a product standard, not a compliance checkbox.
- Ran 60+ moderated user research sessions with patients and clinic staff and synthesized them into a service blueprint that shaped the 2020 roadmap.
- Redesigned the rescheduling flow, reducing no-shows by 18% and support tickets by 25%.

Product Designer, Northwind Travel · San Francisco, CA · August 2013 – May 2017
- Designed booking, checkout, and itinerary features for a travel marketplace with 300K weekly users.
- Shipped A/B tested checkout improvements that lifted conversion 9%.
- Prototyped interactions in Framer and HTML/CSS and collaborated daily with front-end engineers.

Education
BFA, Interaction Design, California College of the Arts, 2013

Skills
Product design, interaction design, design systems, Figma, prototyping, user research, usability testing, accessibility (WCAG), information architecture, AI product design, HTML/CSS, React, data visualization, A/B testing, design leadership, mentoring
`;

export const RESUME_OLDER = RESUME.replace("Lead Product Designer | AI-Assisted Workflows | Design Systems", "Senior Product Designer | Fintech | Healthcare")
  .replace(/Watching a rough prototype[^\n]*\n/, "\n");

export const RESUME_SYSTEMS = RESUME.replace("Lead Product Designer | AI-Assisted Workflows | Design Systems", "Design Systems Lead | Figma + React | Accessibility");

export const PROFILE_DOC = `# Candidate Fact Canon (Positive Profile)

**Jordan Avery** · Portland, Oregon · jordan.avery@example.com · (503) 555-0148
jordanavery.example.com · linkedin.com/in/jordanavery-example

## Summary & Core Positioning
- Lead Product Designer with 13 years in product and interaction design, the last 5 in fintech. Player-coach: leads a small team and still designs the hardest flows directly.
- Led design for Ledger Assist at Copperline Finance, an AI assistant that drafts journal entries and flags anomalies. Time-to-close down 38% across 4,000 customer finance teams.
- Built Penny, Copperline's design system (Figma + React), adopted by 9 product teams.
- Designs human-in-the-loop AI patterns: confidence indicators, editable suggestions, audit trails. AI suggestion acceptance rose from 41% to 67%.
- Healthcare background: patient scheduling at Harborview Health for 1.2M monthly users, WCAG 2.1 AA remediation across 140 screens.

## Core Disciplines & Expertise
- Interaction design, information architecture, design systems, prototyping (Figma, Framer, HTML/CSS, React)
- User research: 60+ moderated sessions, service blueprints, usability testing
- Payments: approval and payout flows moving $2B a year, with risk and compliance partners

## Leadership
- Manages 5 product designers and 1 UX researcher. Owns hiring, critique, and career ladders.
- Has not managed managers.
`;

export const GAPS_DOC = `# Gaps and Standing Reframes (Negative Profile)

## Hard gaps
- No people-manager-of-managers experience. Largest team: 6.
- No native mobile engineering. Designs for iOS/Android, does not build them.
- Not willing to relocate or work onsite 5 days a week.

## Reframable gaps
- Consumer social / growth loops: limited. Reframe: Northwind Travel checkout experiments (+9% conversion) and Harborview rescheduling (−18% no-shows) were growth work under another name.
- Formal ML training: none. Reframe: works with ML engineers on evaluation sets and failure modes; designs for model uncertainty rather than around it.
`;

// ── Hero jobs ──────────────────────────────────────────────────────────────

export const KESTREL_POSTING = `Kestrel AI is building the operating layer for AI agents at work. Teams at more than 1,200 companies use Kestrel to hand off multi-step work (research, reconciliation, reporting) to agents they can supervise, correct, and trust.

About the Role
We're looking for a Principal Product Designer to lead design for Agent Workflows, the surface where people hand work to agents, watch it happen, and step in when they need to. You'll shape how supervision, review, and recovery feel across the product, and you'll set the bar for how we design for systems that are sometimes wrong.

What You'll Do
- Lead end-to-end design for Agent Workflows, from problem framing to polished execution.
- Define interaction patterns for review, approval, and correction of agent output.
- Partner with product, engineering, and research leadership to set direction and make tradeoffs.
- Prototype in code or high-fidelity tools to test ideas with customers early.
- Mentor designers across the team and raise the bar for craft.

What We're Looking For
Minimum qualifications:
- 10+ years of product design experience, including complex B2B or workflow software.
- A portfolio that shows high standards for design craft alongside shipped, measurable outcomes.
- Experience designing AI or ML-powered features with real users.

Preferred qualifications:
- Experience with design systems at scale.
- Comfort prototyping in code.
- Background in finance, operations, or other high-trust domains.

You move quickly, invite feedback from many perspectives, and ship often.

Compensation: $215,000 – $265,000 base, plus equity. Hybrid in San Francisco, 2 days a week in the office.`;

export const KESTREL_FITNESS = {
  company: "Kestrel AI",
  title: "Principal Product Designer, Agent Workflows",
  location: "San Francisco, CA",
  work_arrangement: "Hybrid, 2 days a week in office",
  travel_percent: "not stated",
  salary: "$215,000 – $265,000",
  hard_stop: { triggered: false, reason: "" },
  employer_type: "in_house",
  employer_type_note: "In-house product company. Principal at this size usually means senior IC with team-wide influence, not people management.",
  logistics_note: "Hybrid 2 days in SF; Portland-based, so this needs a travel arrangement or remote exception. Worth raising early with the recruiter.",
  stated_minimums: [
    { verbatim: "10+ years of product design experience, including complex B2B or workflow software.", kind: "objective", verdict: "MEET", note: "13 years; Copperline close and payments workflows are complex B2B." },
    { verbatim: "A portfolio that shows high standards for design craft alongside shipped, measurable outcomes.", kind: "objective", verdict: "MEET", note: "Ledger Assist (−38% time-to-close), Harborview rescheduling (−18% no-shows)." },
    { verbatim: "Experience designing AI or ML-powered features with real users.", kind: "objective", verdict: "MEET", note: "Ledger Assist; suggestion acceptance 41% → 67% with human-in-the-loop patterns." },
    { verbatim: "You move quickly, invite feedback from many perspectives, and ship often.", kind: "dispositional", verdict: "ADJACENT", note: "Evidence of shipping cadence is implied, not stated. Bring a concrete example." },
  ],
  preferred: [
    { verbatim: "Experience with design systems at scale.", verdict: "MEET" },
    { verbatim: "Comfort prototyping in code.", verdict: "ADJACENT" },
    { verbatim: "Background in finance, operations, or other high-trust domains.", verdict: "MEET" },
  ],
  score: 8,
  band: "priority target",
  verdict: "APPLY",
  one_line: "All three stated minimums met directly, and the role centers on the review-and-correction patterns Jordan has already shipped in finance.",
  gaps: [
    { gap: "Prototyping in code is HTML/CSS and React-for-design-system work, not production engineering.", framing: "I prototype in HTML/CSS and React when interaction details matter, and I built Penny's components alongside engineers. I use code to answer design questions quickly. I don't present myself as a production engineer." },
    { gap: "Hybrid in SF; candidate is in Portland.", framing: "I'm in Portland and happy to be in SF regularly for planning and critique. I'd like to agree on a rhythm that keeps the team close without a weekly commute." },
  ],
  outcomes: {
    best_case: "Jordan leads Agent Workflows and sets the review and recovery patterns the rest of Kestrel builds on, drawing directly on Ledger Assist.",
    probable: "A strong interview loop on craft and AI patterns; the location conversation decides the offer terms.",
    worst_case: "The team holds firm on 2 days a week in SF and the commute outweighs the role.",
  },
  tradeoffs: {
    gained: "Principal scope on the problem Jordan knows best, at a company whose product is the problem.",
    lost: "Regular travel to SF, and a step away from finance domain depth.",
  },
};

export const FERNWAY_POSTING = `Lead Product Designer, Payments
Fernway · Remote (US) · Full-time

About Fernway
Fernway helps 30,000 small businesses get paid faster. Our invoicing, payments, and cash-flow tools move more than $8B a year for contractors, clinics, and studios that can't afford to wait 60 days for a check.

The Role
We're hiring a Lead Product Designer to own the design of Fernway Payments: how businesses send invoices, collect payments, and reconcile what came in. You'll lead a team of three designers, partner with product management and engineering leadership, and own the quality of the experience end to end.

What You'll Do
- Lead product design for payments, invoicing, and reconciliation across web and mobile.
- Manage and mentor a team of three product designers; run critique and set craft standards.
- Partner with product management, engineering, risk, and compliance to shape the roadmap.
- Plan and run user research and usability testing with small-business owners and their bookkeepers.
- Prototype new flows quickly in Figma and test them before they're built.
- Contribute to and evolve our design system so every team ships consistent, accessible UI.
- Use data visualization and A/B testing to measure impact and make tradeoffs visible.

What You Bring
- 8+ years of product design experience, including 2+ years leading designers.
- Shipped work in fintech, payments, or another regulated domain.
- Deep skill in interaction design, information architecture, and prototyping.
- Experience building or scaling a design system.
- A track record of accessibility (WCAG) as a standard, not an afterthought.
- Comfort designing AI-assisted features, like categorization and anomaly detection.
- Bachelor's degree in design, HCI, or equivalent practical experience.

Compensation
$185,000 – $225,000 base salary, plus equity and benefits. Fully remote in the US.`;

export const FERNWAY_REWRITE = `Jordan Avery
Lead Product Designer, Payments | Design Systems | AI-Assisted Workflows
Portland, Oregon · (503) 555-0148 · jordan.avery@example.com · linkedin.com/in/jordanavery-example

Summary
Lead Product Designer with 13 years of experience, the last five designing payments and finance workflows. I lead a team of six and still design the hardest flows myself. At Copperline Finance I led design for payment approvals, vendor payouts, and Ledger Assist, an AI assistant that cut time-to-close by 38% for 4,000 finance teams.

Experience

Lead Product Designer, Copperline Finance · Portland, OR (remote) · March 2021 – Present
- Led design for payment approval and vendor payout flows moving $2B a year, partnering with risk and compliance on every release.
- Led design for Ledger Assist, an AI assistant that drafts journal entries and flags anomalies, cutting time-to-close by 38% for 4,000 customer finance teams.
- Hired and manage 5 product designers and 1 UX researcher; run weekly critique and wrote the team's career ladder.
- Created Penny, a cross-platform design system in Figma and React adopted by 9 product teams, reducing UI defects by 30%.
- Prototyped new flows in Figma and tested them with customers before engineering started, working with product management and engineering leadership on the roadmap.
- Introduced human-in-the-loop review patterns (confidence indicators, editable suggestions, audit trails) that raised AI suggestion acceptance from 41% to 67%.

Senior Product Designer, Harborview Health · Seattle, WA · June 2017 – February 2021
- Owned end-to-end design for patient scheduling across iOS, Android, and web, serving 1.2M monthly active users.
- Led accessibility remediation to WCAG 2.1 AA across 140 screens and made AA the release standard for new work.
- Ran 60+ moderated user research sessions with patients and clinic staff and turned them into a service blueprint that shaped the 2020 roadmap.
- Redesigned the rescheduling flow, reducing no-shows by 18% and support tickets by 25%.

Product Designer, Northwind Travel · San Francisco, CA · August 2013 – May 2017
- Designed booking, checkout, and itinerary features for a travel marketplace with 300K weekly users.
- Shipped A/B tested checkout improvements that lifted conversion 9%.
- Prototyped interactions in Framer and HTML/CSS and collaborated daily with front-end engineers.

Education
BFA, Interaction Design, California College of the Arts, 2013

Skills
Payments and invoicing UX, interaction design, information architecture, design systems, Figma, prototyping, user research, usability testing, accessibility (WCAG), AI product design, data visualization, A/B testing, HTML/CSS, React, design leadership, mentoring
`;

export const AI_DETECTION = {
  confidence: 38,
  band: "moderate",
  patterns: [
    {
      label: "Negative parallelism / antithesis",
      signal: 52,
      message: "Repeated 'not X, but Y' and 'rather than' constructions are a common LLM rhythm, and they recur through the resume.",
      examples: [
        "I design not just screens, but the systems behind them",
        "owning hiring, critique, and career ladders rather than leaving growth to chance",
        "rather than handing off static specs",
        "treating accessibility as a product standard, not a compliance checkbox",
      ],
    },
    {
      label: "Narrative opener flourish",
      signal: 34,
      message: "The summary closes on a reflective sentence whose smooth cadence reads more like generated prose than a resume statement.",
      examples: [
        "Watching a rough prototype become something a finance team relies on every morning is the part of this work I look forward to most.",
      ],
    },
    {
      label: "Smooth uniform clause rhythm",
      signal: 27,
      message: "Several long bullets share an evenly balanced multi-clause rhythm, though they're grounded in concrete detail.",
      examples: [
        "turning complex, high-stakes workflows into products people trust",
        "the patterns, research practice, and design systems that let teams ship with confidence",
      ],
    },
  ],
};

export const TIDEWELL_POSTING = `Principal Product Designer, Consumer
Tidewell Bank · New York, NY (hybrid) · $200,000 – $240,000

Tidewell is a digital bank for people who are tired of being surprised by their own money. Two million members use Tidewell to get paid early, avoid overdraft fees, and see what's coming before it hits.

About the role
As Principal Product Designer on the Consumer team, you'll lead design for the moments that matter most to members: getting paid, paying bills, and recovering when something goes wrong. You'll set the design vision for the member app, partner with product, engineering, risk, and compliance, and mentor designers across the team.

What you'll do
- Lead design for core money-movement flows in the Tidewell app, including errors and recovery states.
- Use research, analytics, experimentation, and prototypes to guide decisions.
- Evolve the Tidewell design system and our accessibility standards.
- Establish AI-assisted design practices across the team.
- Mentor designers and raise the bar for craft.

What you bring
- 10+ years designing consumer or fintech products.
- Experience leading complex, regulated product areas end to end.
- Strong interaction design and prototyping skills.
- Experience designing AI-powered features is a plus.`;

export const TIDEWELL_COVER = {
  interests: "I like that Tidewell treats a late fee as a design failure. Recovery flows are where trust is won or lost.",
  date: "October 9, 2026",
  contact: {
    name: "Jordan Avery",
    address: "Portland, Oregon",
    email: "jordan.avery@example.com",
    phone: "(503) 555-0148",
    website: "jordanavery.example.com",
  },
  letter: `Dear Tidewell hiring team,

Most of my work has been in places where a confusing screen costs someone money. At Copperline Finance I lead design for payment approvals and vendor payouts that move $2B a year, and for Ledger Assist, an AI assistant that cut time-to-close by 38% for 4,000 finance teams. Tidewell's focus on getting paid, paying bills, and recovering when something goes wrong is the same problem, closer to people's everyday lives.

Recovery states are where I'd start. At Harborview Health I redesigned patient rescheduling so that a missed appointment became a two-tap fix instead of a phone call, which reduced no-shows by 18% and support tickets by 25%. I'd bring the same approach to failed payments and overdraft warnings: say plainly what happened, show the next step, and make it easy to undo.

I'd also bring practical experience with AI. The human-in-the-loop patterns I introduced at Copperline (confidence indicators, editable suggestions, audit trails) raised suggestion acceptance from 41% to 67%. I'd like to help Tidewell set the same standard for AI-assisted design: useful, reviewable, and honest about uncertainty.

I lead a team of six and still design the hardest flows myself. I'd welcome the chance to talk about how I could help the Consumer team.

Sincerely,
Jordan Avery`,
};

export const MERIDIAN = {
  company: "Meridian Analytics",
  title: "Head of Design",
  location: "Palo Alto, California",
  salary: "$225K – $260K",
  posting: [
    ["About Meridian", "Meridian is the analytics platform for clinical operations. More than 400 hospitals use Meridian to see where beds, staff, and supplies are needed next, and to act before a shortage becomes a crisis."],
    ["About the role", "This role owns and builds the design function at Meridian, reporting to the CEO and working closely with product and engineering leadership."],
    ["", "You'll inherit a small team, a working design system, and a product that customers rely on every shift. The job is to take all three further: set the standard, grow the team, and decide what design owns and how it earns that ownership."],
    ["", "The role stays hands-on. At this stage, the person leading design still designs the hardest flows, prototypes the ideas that need to be seen to be understood, and sits in on customer calls."],
    ["What you'll do", "Lead product design across the Meridian platform. Hire and develop a team of 4–6 designers. Partner with clinical advisors to turn dense operational data into decisions people can make in seconds. Evolve our design system and accessibility standards."],
    ["What you bring", "10+ years of product design, including 3+ years leading designers. Experience with data-heavy B2B products, ideally in healthcare or another regulated domain. A portfolio that shows both craft and measurable outcomes."],
  ] as [string, string][],
};
