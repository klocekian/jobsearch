import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { LandingPage } from "@/components/LandingPage";

export default async function LoginPage() {
  const userId = await getSessionUserId();
  if (userId) {
    redirect("/jobs");
  }
  return <LandingPage />;
}

