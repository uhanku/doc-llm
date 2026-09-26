import "dotenv/config";

import OpenAI from "openai";

import { DEFAULT_EMBEDDING_DIMENSION } from "../src/lib/constants";

const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_OPENROUTER_EMBEDDING_MODEL = "openai/text-embedding-3-small";

async function main() {
  const apiKey = requireEnv("OPENROUTER_API_KEY");
  const baseURL =
    process.env.OPENROUTER_BASE_URL?.trim() || DEFAULT_OPENROUTER_BASE_URL;
  const model =
    process.env.OPENROUTER_EMBEDDING_MODEL?.trim() ||
    DEFAULT_OPENROUTER_EMBEDDING_MODEL;

  const client = new OpenAI({ apiKey, baseURL });
  const response = await client.embeddings.create({
    model,
    input: ["Embedding connection check."],
    dimensions: DEFAULT_EMBEDDING_DIMENSION,
  });
  const embedding = response.data[0]?.embedding;

  if (!embedding || embedding.length === 0) {
    throw new Error(`${model} returned an empty embedding.`);
  }

  if (embedding.length !== DEFAULT_EMBEDDING_DIMENSION) {
    throw new Error(
      `Embedding dimension mismatch. Expected ${DEFAULT_EMBEDDING_DIMENSION}, received ${embedding.length}.`,
    );
  }

  console.log("Embedding connection succeeded.");
  console.log(`Base URL: ${baseURL}`);
  console.log(`Model: ${model}`);
  console.log(`Dimension: ${embedding.length}`);
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for the embedding connection check.`);
  }

  return value;
}

main().catch((error) => {
  const message =
    error instanceof Error
      ? error.message
      : "Embedding connection check failed.";

  console.error(`Embedding connection failed: ${message}`);
  process.exitCode = 1;
});
