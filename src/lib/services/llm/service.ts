import type OpenAI from "openai";

import { DEFAULT_EMBEDDING_DIMENSION } from "@/lib/constants";
import { env } from "@/lib/env";
import { createOpenRouterClient } from "@/lib/services/llm/client";

type LLMServiceClients = {
  embedding: Pick<OpenAI, "embeddings">;
  openRouter?: Pick<OpenAI, "chat">;
};

export class LLMService {
  constructor(private readonly clients: LLMServiceClients) {}

  async createEmbeddings(input: string[]): Promise<number[][]> {
    if (input.length === 0) {
      return [];
    }

    const response = await this.clients.embedding.embeddings.create({
      model: env.OPENROUTER_EMBEDDING_MODEL,
      input,
      dimensions: env.EMBEDDING_DIMENSION,
    });

    return response.data.map((item) => {
      if (item.embedding.length !== DEFAULT_EMBEDDING_DIMENSION) {
        throw new Error(
          `Embedding dimension mismatch. Expected ${DEFAULT_EMBEDDING_DIMENSION}, received ${item.embedding.length}.`,
        );
      }

      return item.embedding;
    });
  }

  async generateText(params: {
    instructions?: string;
    input: string;
  }): Promise<string> {
    const messages: Array<{
      role: "system" | "user";
      content: string;
    }> = [];

    if (params.instructions) {
      messages.push({
        role: "system",
        content: params.instructions,
      });
    }

    messages.push({
      role: "user",
      content: params.input,
    });

    if (!env.OPENROUTER_MODEL) {
      throw new Error("OpenRouter generation is not configured.");
    }

    const client = this.clients.openRouter ?? createOpenRouterClient();
    const response = await client.chat.completions.create({
      model: env.OPENROUTER_MODEL,
      messages,
    });
    const content = response.choices[0]?.message.content;

    if (typeof content !== "string" || content.trim().length === 0) {
      throw new Error("OpenRouter returned an empty assistant response.");
    }

    return content.trim();
  }
}

let llmService: LLMService | undefined;

export function createLLMService(): LLMService {
  if (!llmService) {
    const client = createOpenRouterClient();

    llmService = new LLMService({
      embedding: client,
      openRouter: client,
    });
  }

  return llmService;
}
