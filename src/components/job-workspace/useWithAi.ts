import { useStoredValue } from "@/hooks/useStoredValue";
import { loadWithAi, saveWithAi } from "@/lib/storage";

/** The workspace's "with AI" preference, shared by both Analyze buttons and remembered across visits. */
export function useWithAi(): [boolean, (value: boolean) => void] {
  return useStoredValue(loadWithAi, saveWithAi, false);
}
