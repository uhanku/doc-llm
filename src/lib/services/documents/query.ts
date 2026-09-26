import type { QueryResult } from "pg";

import { pool } from "@/db/client";
import { env } from "@/lib/env";
import { createLLMService } from "@/lib/services/llm/service";
import type { QueryResultChunk } from "@/types/ingestion";

type EmbeddingProvider = Pick<
  ReturnType<typeof createLLMService>,
  "createEmbeddings"
>;

type ChunkQueryClient = {
  query: (
    sql: string,
    values: unknown[],
  ) => Promise<Pick<QueryResult<QueryResultChunk>, "rows">>;
};

type FetchRelevantChunksOptions = {
  userId?: number;
  documentIds?: number[];
  limit?: number;
};

type FetchRelevantChunksDependencies = {
  embeddingProvider?: EmbeddingProvider;
  database?: ChunkQueryClient;
};

function toVectorLiteral(embedding: number[]) {
  return `[${embedding.join(",")}]`;
}

export function formatDocumentSources(matches: QueryResultChunk[]) {
  return matches
    .map(
      (match, index) =>
        `Source ${index + 1} (document ${match.documentId}, score ${match.score.toFixed(3)}):\n${match.content}`,
    )
    .join("\n\n");
}

export async function fetchRelevantChunks(
  question: string,
  options: FetchRelevantChunksOptions = {},
  dependencies: FetchRelevantChunksDependencies = {},
): Promise<QueryResultChunk[]> {
  const embeddingProvider =
    dependencies.embeddingProvider ?? createLLMService();
  const database = dependencies.database ?? pool;
  const limit = options.limit ?? env.INGESTION_QUERY_MATCH_LIMIT;

  const [embedding] = await embeddingProvider.createEmbeddings([question]);
  if (!embedding) {
    throw new Error("Failed to generate a query embedding.");
  }

  const conditions: string[] = [];
  const values: unknown[] = [toVectorLiteral(embedding)];

  if (options.userId) {
    values.push(options.userId);
    conditions.push(`d.owner_id = $${values.length}`);
  }

  if (options.documentIds?.length) {
    values.push(options.documentIds);
    conditions.push(`dc.document_id = ANY($${values.length}::integer[])`);
  }

  values.push(limit);

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const { rows } = await database.query(
    `
      SELECT
        dc.id,
        dc.document_id AS "documentId",
        dc.content,
        1 - (dc.embedding <=> $1::vector) AS score
      FROM document_chunks dc
      INNER JOIN documents d ON dc.document_id = d.id
      ${whereClause}
      ORDER BY dc.embedding <=> $1::vector
      LIMIT $${values.length}
    `,
    values,
  );

  return rows;
}

export async function queryDocumentChunks(input: {
  userId: number;
  question: string;
  documentIds?: number[];
}): Promise<QueryResultChunk[]> {
  const options: FetchRelevantChunksOptions = {
    userId: input.userId,
    limit: env.INGESTION_QUERY_MATCH_LIMIT,
  };

  if (input.documentIds) {
    options.documentIds = input.documentIds;
  }

  return fetchRelevantChunks(input.question, options);
}

export async function generateAnswerFromDocuments(input: {
  userId: number;
  question: string;
  documentIds?: number[];
}) {
  const matches = await queryDocumentChunks(input);

  if (matches.length === 0) {
    return {
      answer:
        "No indexed chunks matched this question yet. Add a document and let the ingestion worker process it first.",
      matches: [],
    };
  }

  const llm = createLLMService();
  const context = formatDocumentSources(matches);

  const answer = await llm.generateText({
    instructions:
      "Answer only from the supplied document context. If the context is insufficient, say so clearly.",
    input: `Question:\n${input.question}\n\nContext:\n${context}`,
  });

  return {
    answer,
    matches,
  };
}
