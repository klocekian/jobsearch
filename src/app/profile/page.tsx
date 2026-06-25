"use client";

import { ProfileView } from "@/components/ProfileView";

export default function ProfilePage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8">
      <h1 className="mb-6 text-xl font-bold text-slate-900">Profile</h1>
      <ProfileView />
    </main>
  );
}
