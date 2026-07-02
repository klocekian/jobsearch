import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getUserById } from "@/lib/db/users";
import { getDb } from "@/lib/db/index";

export const runtime = "nodejs";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";

async function refreshGoogleToken(userId: number, refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token: string; expires_in?: number };
    const db = await getDb();
    await db.execute({
      sql: "UPDATE users SET google_access_token = ?, google_token_expires = ?, updated_at = datetime('now') WHERE id = ?",
      args: [data.access_token, data.expires_in ? Math.floor(Date.now() / 1000) + data.expires_in : null, userId],
    });
    return data.access_token;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const session = await getSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const user = await getUserById(session.id);
  if (!user?.google_access_token) {
    return NextResponse.json({ error: "Calendar not connected. Sign out and sign in again to grant calendar access." }, { status: 403 });
  }

  let token = user.google_access_token;
  const now = Math.floor(Date.now() / 1000);
  if (user.google_token_expires && now >= user.google_token_expires - 60 && user.google_refresh_token) {
    const refreshed = await refreshGoogleToken(user.id, user.google_refresh_token);
    if (refreshed) token = refreshed;
  }

  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  const date = dateParam ? new Date(dateParam) : new Date();
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const calUrl = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  calUrl.searchParams.set("timeMin", dayStart.toISOString());
  calUrl.searchParams.set("timeMax", dayEnd.toISOString());
  calUrl.searchParams.set("singleEvents", "true");
  calUrl.searchParams.set("orderBy", "startTime");
  calUrl.searchParams.set("maxResults", "50");

  const calRes = await fetch(calUrl.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!calRes.ok) {
    if (calRes.status === 401 && user.google_refresh_token) {
      const refreshed = await refreshGoogleToken(user.id, user.google_refresh_token);
      if (refreshed) {
        const retry = await fetch(calUrl.toString(), {
          headers: { Authorization: `Bearer ${refreshed}` },
        });
        if (retry.ok) {
          const data = await retry.json();
          return NextResponse.json({ events: formatEvents(data.items ?? []) });
        }
      }
    }
    return NextResponse.json({ error: "Failed to fetch calendar. Try signing out and in again." }, { status: 502 });
  }

  const data = await calRes.json();
  return NextResponse.json({ events: formatEvents(data.items ?? []) });
}

interface CalEvent {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  htmlLink?: string;
}

function formatEvents(items: CalEvent[]) {
  return items.map((e) => ({
    id: e.id,
    title: e.summary ?? "(No title)",
    start: e.start?.dateTime ?? e.start?.date ?? "",
    end: e.end?.dateTime ?? e.end?.date ?? "",
    allDay: !e.start?.dateTime,
    link: e.htmlLink,
  }));
}
