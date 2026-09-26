import OpenAI from "openai";

import { env } from "@/lib/env";

let openRouterClient: OpenAI | undefined;

export function createOpenRouterClient(): OpenAI {
  if (!env.OPENROUTER_API_KEY) {
    throw new Error("OpenRouter is not configured.");
  }

  if (!openRouterClient) {
    openRouterClient = new OpenAI({
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: env.OPENROUTER_BASE_URL,
    });
  }

  return openRouterClient;
}
