"use client";

import { ProfileView } from "@/components/ProfileView";
import { Text } from "@astryxdesign/core/Text";

export default function ProfilePage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8">
      <Text type="display-3" as="h1" className="mb-6">Profile</Text>
      <ProfileView />
    </main>
  );
}
