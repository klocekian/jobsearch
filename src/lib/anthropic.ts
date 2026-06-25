import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "./auth";

export async function getAnthropicClient(): Promise<Anthropic> {
  const user = await getSession().catch(() => null);
  const userToken = user?.anthropic_token;

  if (userToken) {
    if (userToken.startsWith("sk-ant-oat")) {
      return new Anthropic({ authToken: userToken, apiKey: undefined });
    }
    return new Anthropic({ apiKey: userToken });
  }

  // Fall back to global env vars (SDK reads these automatically)
  return new Anthropic();
}
