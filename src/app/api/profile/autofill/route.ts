import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { updateProfileData } from "@/lib/db/users";
import { getAutofillFields } from "@/lib/profile-autofill";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getSession().catch(() => null);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await request.json();
  await updateProfileData(user.id, JSON.stringify(body));
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const user = await getSession().catch(() => null);
  const fields = await getAutofillFields(user?.id ?? null, user?.email);
  if ("error" in fields) return NextResponse.json(fields, { status: 404 });
  return NextResponse.json(fields);
}
