import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/api-response";
import { withUser } from "@/lib/api-auth";
import { getUserById, updateProfileData } from "@/lib/db/users";
import { getAutofillFields } from "@/lib/profile-autofill";

export const runtime = "nodejs";

// The Application Fields form: a flat map of short text fields and checkboxes.
const ProfileFieldsSchema = z
  .record(z.string().max(50), z.union([z.string().max(2000), z.boolean()]))
  .refine((fields) => Object.keys(fields).length <= 50, "Too many fields.");

export const POST = withUser(async (request, userId) => {
  const body = await parseBody(request, ProfileFieldsSchema);
  if (body.error) return body.error;
  await updateProfileData(userId, JSON.stringify(body.data));
  return NextResponse.json({ ok: true });
});

export const GET = withUser(async (_request, userId) => {
  const user = await getUserById(userId);
  const fields = await getAutofillFields(userId, user?.email);
  if ("error" in fields) return NextResponse.json(fields, { status: 404 });
  return NextResponse.json(fields);
});
