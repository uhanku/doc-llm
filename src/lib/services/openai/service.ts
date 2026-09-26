import type OpenAI from "openai";

import { DEFAULT_EMBEDDING_DIMENSION } from "@/lib/constants";
import { env } from "@/lib/env";
import {
  createOpenAIClient,
  createOpenRouterClient,
} from "@/lib/services/openai/client";

type OpenAIServiceClients = {
  embedding: Pick<OpenAI, "embeddings">;
  openAI?: Pick<OpenAI, "responses">;
  openRouter?: Pick<OpenAI, "chat">;
};

export class OpenAIService {
  constructor(private readonly clients: OpenAIServiceClients) {}

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
    if (env.LLM_PROVIDER === "openrouter") {
      return this.generateOpenRouterText(params);
    }

    return this.generateOpenAIText(params);
  }

  private async generateOpenAIText(params: {
    instructions?: string;
    input: string;
  }): Promise<string> {
    if (!env.OPENAI_GENERATION_MODEL) {
      throw new Error("OpenAI generation is not configured.");
    }

    const request: {
      model: string;
      input: string;
      instructions?: string | null;
    } = {
      model: env.OPENAI_GENERATION_MODEL,
      input: params.input,
    };

    if (params.instructions) {
      request.instructions = params.instructions;
    }

    const client = this.clients.openAI ?? createOpenAIClient();
    const response = await client.responses.create(request);

    return response.output_text.trim();
  }

  private async generateOpenRouterText(params: {
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

let openAIService: OpenAIService | undefined;

export function createOpenAIService(): OpenAIService {
  if (!openAIService) {
    const openRouter = createOpenRouterClient();
    const clients: OpenAIServiceClients = {
      embedding: openRouter,
    };

    if (env.LLM_PROVIDER === "openrouter") {
      clients.openRouter = openRouter;
    } else {
      clients.openAI = createOpenAIClient();
    }

    openAIService = new OpenAIService(clients);
  }

  return openAIService;
}
