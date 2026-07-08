import { ProfileView } from "@/components/ProfileView";
import { Text } from "@astryxdesign/core/Text";
import { getSession } from "@/lib/auth";
import { getUserClaudeStatus } from "@/lib/anthropic";
import { getAutofillFields } from "@/lib/profile-autofill";

export default async function ProfilePage() {
  const user = await getSession().catch(() => null);
  const [claudeStatus, autofillFields] = await Promise.all([
    user ? getUserClaudeStatus(user) : Promise.resolve("none" as const),
    getAutofillFields(user?.id ?? null, user?.email),
  ]);
  const initialUser = user ? { id: user.id, name: user.name, email: user.email, claudeStatus } : null;

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8">
      <Text type="display-3" as="h1" className="mb-6">Profile</Text>
      <ProfileView initialUser={initialUser} initialAutofillFields={autofillFields} />
    </main>
  );
}
