import { getSession } from "./auth";

export async function getCurrentUserId(): Promise<number | null> {
  const user = await getSession();
  return user?.id ?? null;
}
