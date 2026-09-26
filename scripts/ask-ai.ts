import "dotenv/config";

function printUsage() {
  console.log(`Usage:
  npm run ask:ai -- "What is retrieval augmented generation?"

Options:
  --help, -h    Show this help message.`);
}

function parseQuestion(args: string[]) {
  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  const question = args.join(" ").trim();

  if (!question) {
    throw new Error("Pass a question to ask the AI.");
  }

  return question;
}

async function main() {
  const question = parseQuestion(process.argv.slice(2));
  const { createLLMService } = await import("../src/lib/services/llm/service");

  const service = createLLMService();
  const response = await service.generateText({
    input: question,
  });

  console.log(response);
}

main().catch((error) => {
  const message =
    error instanceof Error ? error.message : "Failed to get an AI response.";
  console.log(error);
  console.error(`AI request failed: ${message}`);
  printUsage();
  process.exitCode = 1;
});
