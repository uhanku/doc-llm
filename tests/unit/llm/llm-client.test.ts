const openAIClient = {
  embeddings: {
    create: vi.fn(async () => ({
      data: [{ embedding: Array.from({ length: 1536 }, () => 0.1) }],
    })),
  },
  chat: {
    completions: {
      create: vi.fn(async () => ({
        choices: [{ message: { content: "connection ok" } }],
      })),
    },
  },
};

const mocks = vi.hoisted(() => ({
  OpenAI: vi.fn(() => openAIClient),
}));

vi.mock("openai", () => ({
  default: mocks.OpenAI,
}));

describe("createOpenRouterClient", () => {
  const originalEnv = {
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL,
    OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
    OPENROUTER_EMBEDDING_MODEL: process.env.OPENROUTER_EMBEDDING_MODEL,
    EMBEDDING_DIMENSION: process.env.EMBEDDING_DIMENSION,
  };

  afterEach(() => {
    restoreEnvValue("OPENROUTER_API_KEY", originalEnv.OPENROUTER_API_KEY);
    restoreEnvValue("OPENROUTER_BASE_URL", originalEnv.OPENROUTER_BASE_URL);
    restoreEnvValue("OPENROUTER_MODEL", originalEnv.OPENROUTER_MODEL);
    restoreEnvValue(
      "OPENROUTER_EMBEDDING_MODEL",
      originalEnv.OPENROUTER_EMBEDDING_MODEL,
    );
    restoreEnvValue("EMBEDDING_DIMENSION", originalEnv.EMBEDDING_DIMENSION);
  });

  it("configures embeddings for the OpenRouter embedding endpoint", async () => {
    vi.resetModules();
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
    process.env.OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
    process.env.OPENROUTER_EMBEDDING_MODEL = "openai/text-embedding-3-small";
    process.env.EMBEDDING_DIMENSION = "1536";

    const { createOpenRouterClient } =
      await import("@/lib/services/llm/client");
    const { LLMService } = await import("@/lib/services/llm/service");

    const client = createOpenRouterClient();
    const service = new LLMService({
      embedding: client,
      openRouter: { chat: { completions: { create: vi.fn() } } },
    } as never);

    await service.createEmbeddings(["connection check"]);

    expect(mocks.OpenAI).toHaveBeenCalledWith({
      apiKey: "test-openrouter-key",
      baseURL: "https://openrouter.ai/api/v1",
    });
    expect(openAIClient.embeddings.create).toHaveBeenCalledWith({
      model: "openai/text-embedding-3-small",
      input: ["connection check"],
      dimensions: 1536,
    });
  });

  it("configures generation for OpenRouter", async () => {
    vi.resetModules();
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
    process.env.OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
    process.env.OPENROUTER_MODEL = "openai/gpt-5-mini";

    const { createOpenRouterClient } =
      await import("@/lib/services/llm/client");
    const { LLMService } = await import("@/lib/services/llm/service");

    const client = createOpenRouterClient();
    const service = new LLMService({
      embedding: { embeddings: { create: vi.fn() } },
      openRouter: client,
    } as never);

    await expect(
      service.generateText({
        instructions: "Reply with ok.",
        input: "connection check",
      }),
    ).resolves.toBe("connection ok");

    expect(mocks.OpenAI).toHaveBeenCalledWith({
      apiKey: "test-openrouter-key",
      baseURL: "https://openrouter.ai/api/v1",
    });
    expect(openAIClient.chat.completions.create).toHaveBeenCalledWith({
      model: "openai/gpt-5-mini",
      messages: [
        {
          role: "system",
          content: "Reply with ok.",
        },
        {
          role: "user",
          content: "connection check",
        },
      ],
    });
  });
});

function restoreEnvValue(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
