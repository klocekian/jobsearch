import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { LandingPage } from "@/components/LandingPage";

export const metadata: Metadata = {
  title: "Job Search by Fieldlines | Find work worth pursuing",
  description:
    "Save interesting roles, understand how your experience fits, tailor your resume and cover letter, and keep track of every application with Job Search by Fieldlines.",
};

export default async function Home() {
  const userId = await getSessionUserId();
  if (userId) {
    redirect("/jobs");
  }
  return <LandingPage />;
}
