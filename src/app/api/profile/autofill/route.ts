import { NextResponse } from "next/server";
import { withUser } from "@/lib/api-auth";
import { getUserById, updateProfileData } from "@/lib/db/users";
import { getAutofillFields } from "@/lib/profile-autofill";

export const runtime = "nodejs";

export const POST = withUser(async (request, userId) => {
  const body = await request.json();
  await updateProfileData(userId, JSON.stringify(body));
  return NextResponse.json({ ok: true });
});

export const GET = withUser(async (_request, userId) => {
  const user = await getUserById(userId);
  const fields = await getAutofillFields(userId, user?.email);
  if ("error" in fields) return NextResponse.json(fields, { status: 404 });
  return NextResponse.json(fields);
});
