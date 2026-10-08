import { Suspense } from "react";
import Link from "next/link";
import { ProfileView } from "@/components/ProfileView";
import { Text } from "@astryxdesign/core/Text";
import { Spinner } from "@astryxdesign/core/Spinner";
import { ChevronLeftIcon } from "@/components/icons";
import { getSession } from "@/lib/auth";
import { getUserClaudeStatus } from "@/lib/anthropic";
import { getAutofillFields } from "@/lib/profile-autofill";

// Async Server Component so its data fetching (session lookup, autofill
// parsing, and the Claude live-token check — a real network call to
// Anthropic when the token has no tracked expiry) streams in behind the
// Suspense boundary below instead of blocking the whole page navigation.
async function ProfileData() {
  const user = await getSession().catch(() => null);
  const [claudeStatus, autofillFields] = await Promise.all([
    user ? getUserClaudeStatus(user) : Promise.resolve("none" as const),
    getAutofillFields(user?.id ?? null, user?.email),
  ]);
  const initialUser = user ? { id: user.id, name: user.name, email: user.email, claudeStatus } : null;
  return <ProfileView initialUser={initialUser} initialAutofillFields={autofillFields} />;
}

export default function ProfilePage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8">
      <div className="mb-6 flex items-center gap-2">
        <Link
          href="/jobs"
          aria-label="Back to jobs"
          className="-ml-1 inline-flex items-center justify-center rounded-md p-1.5 text-secondary transition hover:bg-surface hover:text-primary"
        >
          <ChevronLeftIcon className="h-6 w-6" />
        </Link>
        <Text type="display-3" as="h1">Profile</Text>
      </div>
      <Suspense fallback={<div className="flex justify-center py-12"><Spinner label="Loading profile…" /></div>}>
        <ProfileData />
      </Suspense>
    </main>
  );
}
