import type { Metadata } from "next";

// Public page: the Chrome Web Store listing links here, so it must render for
// signed-out visitors ("/privacy" is in publicPaths in src/proxy.ts).

export const metadata: Metadata = {
  title: "Privacy Policy — Job Search",
  description: "How Job Search and the Job Search Clipper Chrome extension handle your data.",
};

const CONTACT_EMAIL = "stefan.klocek@gmail.com";
const OPERATOR = "Fieldlines";
const EFFECTIVE_DATE = "November 1, 2026";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-10 mb-3 text-lg font-semibold">{children}</h2>;
}

function Mail() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
      {CONTACT_EMAIL}
    </a>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 text-sm leading-relaxed [&_li]:mt-1.5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
      <h1 className="text-2xl font-bold">Privacy Policy</h1>
      <p className="text-secondary">Effective {EFFECTIVE_DATE}</p>

      <p>
        This policy covers the Job Search web app at https://jobs.fieldlines.org (the
        &ldquo;Service&rdquo;) and the Job Search Clipper Chrome extension (the &ldquo;Extension&rdquo;),
        both run by {OPERATOR} (&ldquo;we&rdquo;, &ldquo;us&rdquo;).
      </p>

      <H2>What we collect</H2>
      <p>
        <strong>Account information.</strong> When you sign in with Google we receive your name and
        email address. We don&rsquo;t receive your Google password or have access to other Google data.
      </p>
      <p>
        <strong>What you save in the Service.</strong> This includes:
      </p>
      <ul>
        <li>
          Jobs you add: company, title, location, salary, the posting&rsquo;s URL and description,
          status, notes, and anything you record about your applications.
        </li>
        <li>Resumes and candidate documents you upload or write.</li>
        <li>
          The application details on your Profile page: name, email, phone, address, city, state,
          current title and employer, profile links, and your answers about work authorization and
          sponsorship.
        </li>
        <li>API keys for AI providers you choose to connect.</li>
      </ul>
      <p>
        <strong>What the Extension handles.</strong>
      </p>
      <ul>
        <li>
          <em>Clip:</em> when you click &ldquo;Clip this page&rdquo;, the Extension reads the posting on
          the current tab: its URL, title, meta description, structured job data, and visible text (or
          only the text you selected). This goes to your account only when you click &ldquo;Save
          Job&rdquo; or &ldquo;Re-extract with AI&rdquo;.
        </li>
        <li>
          <em>Fill:</em> when you open the Fill tab or click &ldquo;Fill application fields&rdquo;, the
          Extension downloads your saved application details from your account and enters them into
          the form on the current tab. It doesn&rsquo;t read or send anything else you type into that
          form, and it never submits it.
        </li>
        <li>
          <em>Already-saved check:</em> when the side panel opens, it downloads your saved jobs and
          compares the current tab&rsquo;s address with them on your device. That address isn&rsquo;t
          sent to us.
        </li>
        <li>
          <em>Settings:</em> the Extension keeps two preferences on your device, in Chrome&rsquo;s local
          storage: the server address and whether the recent-clips list is collapsed.
        </li>
      </ul>
      <p>
        The Extension does nothing on a page until you click a button. It doesn&rsquo;t track your
        browsing, record clicks or keystrokes, show ads, or include analytics.
      </p>

      <H2>How we use it</H2>
      <p>
        Only to provide the Service: storing your job search, showing it back to you, analyzing your
        fit for roles, drafting resumes and cover letters, and filling applications when you ask. We
        don&rsquo;t sell your data, use it for advertising, or use it to decide on credit or lending.
      </p>

      <H2>AI processing</H2>
      <p>
        Some features send text to an AI provider: extracting fields from a posting, fit checks,
        resume rewrites and cover letters. The request includes the posting text and, for features
        that need it, your resume or profile text. It goes to the provider you connected under
        Profile → AI (Anthropic, Google Gemini, xAI Grok or Mistral). If you haven&rsquo;t connected
        one, it may go to a provider we pay for. The provider handles the request under its own terms
        and privacy policy. These calls happen only when you use an AI feature.
      </p>
      <p>
        If you connect Claude, ChatGPT or another assistant to your account (through MCP), that
        assistant can read and change your job search data on your behalf. You can disconnect it at
        any time from your Profile.
      </p>

      <H2>Who else handles your data</H2>
      <ul>
        <li>
          <strong>Hosting and storage:</strong> the Service runs on Vercel, and its database is hosted
          by Turso.
        </li>
        <li>
          <strong>Sign-in:</strong> Google, for authentication.
        </li>
        <li>
          <strong>AI providers:</strong> as described above.
        </li>
      </ul>
      <p>We don&rsquo;t share your data with anyone else, unless the law requires it.</p>

      <H2>Security</H2>
      <p>
        All traffic between the Extension, your browser and the Service uses HTTPS. Every record
        belongs to one account and is shown only to that account&rsquo;s owner. No method of storing or
        sending data is perfectly secure, but we take reasonable steps to protect yours.
      </p>

      <H2>Keeping and deleting your data</H2>
      <p>
        Your data stays in your account until you delete it. You can delete individual jobs and
        resumes, and disconnect AI providers and connected apps, at any time. To delete your whole
        account and everything in it, email <Mail />. We&rsquo;ll do it within 30 days. Uninstalling the
        Extension removes its local settings.
      </p>

      <H2>Children</H2>
      <p>
        The Service isn&rsquo;t meant for anyone under 16, and we don&rsquo;t knowingly collect their
        data.
      </p>

      <H2>Chrome Web Store Limited Use</H2>
      <p>
        The Extension&rsquo;s use of information it receives follows the{" "}
        <a
          href="https://developer.chrome.com/docs/webstore/program-policies/user-data-faq"
          className="underline"
        >
          Chrome Web Store User Data Policy
        </a>
        , including the Limited Use requirements.
      </p>

      <H2>Changes</H2>
      <p>
        If this policy changes, we&rsquo;ll update the effective date above. For significant changes,
        we&rsquo;ll also tell you in the Service.
      </p>

      <H2>Contact</H2>
      <p>
        <Mail />
      </p>
    </main>
  );
}
