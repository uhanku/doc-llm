import { vi } from "vitest";

import { DEFAULT_EMBEDDING_DIMENSION } from "@/lib/constants";

export function createMockLLMService() {
  return {
    createEmbeddings: vi.fn(async (input: string[]) =>
      input.map((_, index) =>
        Array.from({ length: DEFAULT_EMBEDDING_DIMENSION }, () => index + 0.1),
      ),
    ),
    generateText: vi.fn(async () => "Mock generated answer."),
  };
}
