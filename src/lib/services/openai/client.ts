import OpenAI from "openai";

import { env } from "@/lib/env";

let generationClient: OpenAI | undefined;
let openRouterClient: OpenAI | undefined;

export function createOpenAIClient(): OpenAI {
  if (!env.OPENAI_API_KEY || !env.OPENAI_GENERATION_MODEL) {
    throw new Error("OpenAI generation is not configured.");
  }

  if (!generationClient) {
    generationClient = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      baseURL: env.OPENAI_BASE_URL,
    });
  }

  return generationClient;
}

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
