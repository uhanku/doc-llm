import { DEFAULT_EMBEDDING_DIMENSION } from "@/lib/constants";
import { env } from "@/lib/env";
import { LLMService } from "@/lib/services/llm/service";

describe("LLMService", () => {
  it("maps embedding responses into vectors", async () => {
    const client = {
      embeddings: {
        create: async () => ({
          data: [
            {
              embedding: Array.from(
                { length: DEFAULT_EMBEDDING_DIMENSION },
                () => 0.1,
              ),
            },
          ],
        }),
      },
      chat: {
        completions: {
          create: async () => ({
            choices: [{ message: { content: "Hello world" } }],
          }),
        },
      },
    };

    const service = new LLMService({
      embedding: client,
      openRouter: client,
    } as never);

    const embeddings = await service.createEmbeddings(["hello"]);

    expect(embeddings).toHaveLength(1);
    expect(embeddings[0]).toHaveLength(DEFAULT_EMBEDDING_DIMENSION);
  });

  it("sends OpenRouter chat completion requests and returns trimmed generated text", async () => {
    const create = vi.fn(async () => ({
      choices: [{ message: { content: "  Generated answer  " } }],
    }));
    const client = {
      embeddings: {
        create: async () => ({
          data: [
            {
              embedding: Array.from(
                { length: DEFAULT_EMBEDDING_DIMENSION },
                () => 0.1,
              ),
            },
          ],
        }),
      },
      chat: {
        completions: {
          create,
        },
      },
    };

    const service = new LLMService({
      embedding: client,
      openRouter: client,
    } as never);

    await expect(
      service.generateText({ input: "question", instructions: "be concise" }),
    ).resolves.toBe("Generated answer");
    expect(create).toHaveBeenCalledWith({
      model: env.OPENROUTER_MODEL,
      messages: [
        {
          role: "system",
          content: "be concise",
        },
        {
          role: "user",
          content: "question",
        },
      ],
    });
  });

  it("fails clearly when OpenRouter returns no assistant content", async () => {
    const client = {
      embeddings: {
        create: async () => ({
          data: [
            {
              embedding: Array.from(
                { length: DEFAULT_EMBEDDING_DIMENSION },
                () => 0.1,
              ),
            },
          ],
        }),
      },
      chat: {
        completions: {
          create: async () => ({
            choices: [{ message: { content: "   " } }],
          }),
        },
      },
    };

    const service = new LLMService({
      embedding: client,
      openRouter: client,
    } as never);

    await expect(
      service.generateText({ input: "question" }),
    ).rejects.toThrow("OpenRouter returned an empty assistant response.");
  });
});
