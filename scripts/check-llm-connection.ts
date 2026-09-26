import "dotenv/config";

async function main() {
  const { createLLMService } = await import("../src/lib/services/llm/service");

  const service = createLLMService();
  const response = await service.generateText({
    instructions: "Reply with exactly: ok",
    input: "Connection check.",
  });

  if (response.length === 0) {
    throw new Error("OpenRouter returned an empty response.");
  }

  console.log("OpenRouter connection succeeded.");
  console.log(`Model response: ${response}`);
}

main().catch((error) => {
  const message =
    error instanceof Error ? error.message : "LLM connection check failed.";

  console.error(`LLM connection failed: ${message}`);
  process.exitCode = 1;
});
