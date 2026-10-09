import { cookies } from "next/headers";
import crypto from "node:crypto";
import { getUserById, type UserRow } from "./db/users";
import { sessionSecret } from "./secret";

const SESSION_COOKIE = "jbs_session";

function sign(payload: string): string {
  const hmac = crypto.createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  return `${payload}.${hmac}`;
}

function verify(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const payload = token.slice(0, dot);
  const sig = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(crypto.createHmac("sha256", sessionSecret()).update(payload).digest("base64url"));
  // timingSafeEqual throws on a length mismatch, which turned a malformed
  // cookie into a 500 instead of "not signed in".
  if (sig.length !== expected.length || !crypto.timingSafeEqual(sig, expected)) return null;
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
