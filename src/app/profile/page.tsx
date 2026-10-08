import { Suspense } from "react";
import { ProfileView } from "@/components/ProfileView";
import { Text } from "@astryxdesign/core/Text";
import { Spinner } from "@astryxdesign/core/Spinner";
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
      <Text type="display-3" as="h1" display="block" className="mb-6">Profile</Text>
      <Suspense fallback={<div className="flex justify-center py-12"><Spinner label="Loading profile…" /></div>}>
        <ProfileData />
      </Suspense>
    </main>
  );
}
