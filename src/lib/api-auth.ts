import { getSessionUserId } from "./auth";

export async function getCurrentUserId(): Promise<number | null> {
  return await getSessionUserId();
}
