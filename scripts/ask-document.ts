import "dotenv/config";

type CliOptions = {
  documentId: number;
  question: string;
  limit?: number;
};

function parsePositiveInteger(value: string, name: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

function printUsage() {
  console.log(`Usage:
  npm run ask:document -- --document-id <id> "What does this document say about pricing?"

Options:
  --document-id <id>      Required document id to query.
  --limit <count>         Override INGESTION_QUERY_MATCH_LIMIT.
  --help, -h              Show this help message.`);
}

function parseArgs(args: string[]): CliOptions {
  const questionParts: string[] = [];
  let documentId: number | undefined;
  let limit: number | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg) {
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }

    if (arg === "--document-id") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--document-id requires a value.");
      }

      documentId = parsePositiveInteger(value, "--document-id");
      index += 1;
      continue;
    }

    if (arg === "--limit") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--limit requires a value.");
      }

      limit = parsePositiveInteger(value, "--limit");
      index += 1;
      continue;
    }

    questionParts.push(arg);
  }

  if (!documentId) {
    throw new Error("Pass --document-id to query a document.");
  }

  const question = questionParts.join(" ").trim();
  if (!question) {
    throw new Error("Pass a question to ask about the document.");
  }

  return {
    documentId,
    question,
    ...(limit ? { limit } : {}),
  };
}

async function main() {
  const { documentId, question, limit } = parseArgs(process.argv.slice(2));
  const [{ pool }, queryService, { createLLMService }] = await Promise.all([
    import("../src/db/client"),
    import("../src/lib/services/documents/query"),
    import("../src/lib/services/llm/service"),
  ]);

  try {
    const matches = await queryService.fetchRelevantChunks(question, {
      documentIds: [documentId],
      ...(limit ? { limit } : {}),
    });

    if (matches.length === 0) {
      console.log(
        "No indexed chunks matched this question yet. Add a document and let the ingestion worker process it first.",
      );
      return;
    }

    const sources = queryService.formatDocumentSources(matches);
    const answer = await createLLMService().generateText({
      instructions:
        "Answer only from the supplied document context. If the context is insufficient, say so clearly.",
      input: `Question:\n${question}\n\nContext:\n${sources}`,
    });

    console.log(`Answer\n${answer}\n\nSources\n${sources}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  const message =
    error instanceof Error ? error.message : "Failed to ask the document.";

  console.error(error);
  console.error(message);
  printUsage();
  process.exitCode = 1;
});
