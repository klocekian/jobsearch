import { cookies } from "next/headers";
import crypto from "node:crypto";
import { getUserById, type UserRow } from "./db/users";

const SESSION_COOKIE = "jbs_session";
const SECRET = process.env.SESSION_SECRET || "dev-secret-change-in-production";

function sign(payload: string): string {
  const hmac = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${hmac}`;
}

function verify(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return payload;
}

export async function setSession(userId: number): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, sign(String(userId)), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function getSessionUserId(): Promise<number | null> {
  const store = await cookies();
  const cookie = store.get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  const payload = verify(cookie);
  if (!payload) return null;
  const userId = Number(payload);
  return userId || null;
}

export async function getSession(): Promise<UserRow | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  return (await getUserById(userId)) ?? null;
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function requireUser(): Promise<UserRow> {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");
  return user;
}
