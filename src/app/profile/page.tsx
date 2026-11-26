import { Suspense } from "react";
import { ProfileView } from "@/components/ProfileView";
import { Page } from "@/components/ui/Page";
import { Spinner } from "@/components/ui/Spinner";
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
    user ? getAutofillFields(user.id, user.email) : Promise.resolve({ error: "Not signed in" }),
  ]);
  const initialUser = user ? { id: user.id, name: user.name, email: user.email, claudeStatus } : null;
  return <ProfileView initialUser={initialUser} initialAutofillFields={autofillFields} />;
}

export default function ProfilePage() {
  return (
    <Page title="Settings" crumb={{ label: "Workspace" }} narrow>
      <Suspense fallback={<div className="flex justify-center py-12"><Spinner label="Loading settings…" /></div>}>
        <ProfileData />
      </Suspense>
    </Page>
  );
}
