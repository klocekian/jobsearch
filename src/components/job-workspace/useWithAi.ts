import { useState } from "react";

const STORAGE_KEY = "jobWorkspaceWithAi";

/** The workspace's "with AI" preference, shared by both Analyze buttons and remembered across visits. */
export function useWithAi(): [boolean, (value: boolean) => void] {
  const [withAi, setWithAiState] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY) === "1";
    }
    return false;
  });

  const setWithAi = (value: boolean) => {
    setWithAiState(value);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    }
  };

  return [withAi, setWithAi];
}
