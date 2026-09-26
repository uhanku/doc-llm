import { Readable } from "node:stream";

import { db, pool } from "@/db/client";
import { users } from "@/db/schema";
import { DEFAULT_EMBEDDING_DIMENSION } from "@/lib/constants";
import { createDocument } from "@/lib/services/documents/repository";
import {
  fetchRelevantChunks,
  queryDocumentChunks,
} from "@/lib/services/documents/query";
import { createIngestionJob } from "@/lib/services/ingestion/jobs";
import { TextExtractionService } from "@/lib/services/ingestion/extractor";
import { IngestionProcessor } from "@/lib/services/ingestion/processor";
import { createOpenAIService } from "@/lib/services/openai/service";
import type { ObjectStorageService } from "@/server/storage";
import { getSeededUser } from "../../helpers/db";
import { createPdfBuffer } from "../../helpers/files";

const question = "Who described the movie as deep and spiritual?";
const pdfStorageKey = "documents/test/demon_slayer_comments.pdf";

function createPdfStorage(pdfBuffer: Buffer): ObjectStorageService {
  return {
    backend: "local",
    putObject: async ({
      body,
      contentType,
      originalFilename,
      key,
      checksum,
    }) => ({
      backend: "local",
      key,
      originalFilename,
      contentType,
      byteSize: body.byteLength,
      checksum: checksum ?? null,
    }),
    getObjectStream: async () => Readable.from(pdfBuffer),
    getObjectBuffer: async () => Buffer.from(pdfBuffer),
    deleteObject: async () => undefined,
    exists: async (key) => key === pdfStorageKey,
    getPublicUrl: () => null,
  };
}

async function ingestPdfFixtureForSeededUser() {
  const seededUser = await getSeededUser();
  const pdfBuffer = createPdfBuffer();
  const document = await createDocument({
    ownerId: seededUser.id,
    title: "AI text full v2",
    originalFilename: "demon_slayer_comments.pdf",
    status: "queued",
    storageBackend: "local",
    storageKey: pdfStorageKey,
    contentType: "application/pdf",
    byteSize: pdfBuffer.byteLength,
    metadata: {
      uploadSource: "integration-fixture",
    },
  });
  const job = await createIngestionJob({
    documentId: document.id,
    createdByUserId: seededUser.id,
  });
  const processor = new IngestionProcessor({
    extractor: new TextExtractionService(),
    openAI: createOpenAIService(),
    storage: createPdfStorage(pdfBuffer),
  });

  const result = await processor.process({
    id: job.id,
    documentId: document.id,
  });

  return {
    document,
    result,
    user: seededUser,
  };
}

describe("embedding chunk retrieval integration", () => {
  it("ingests demon_slayer_comments.pdf with OpenRouter embeddings and retrieves relevant pgvector chunks", async () => {
    const sampleEmbedding = await createOpenAIService().createEmbeddings([
      question,
    ]);

    expect(sampleEmbedding).toHaveLength(1);
    expect(sampleEmbedding[0]).toHaveLength(DEFAULT_EMBEDDING_DIMENSION);

    const { document, result, user } = await ingestPdfFixtureForSeededUser();

    expect(result.chunkCount).toBeGreaterThan(0);

    const chunkStats = await pool.query<{
      chunk_count: string;
      embedding_dimensions: number;
    }>(
      `
        SELECT
          count(*) AS chunk_count,
          min(vector_dims(embedding)) AS embedding_dimensions
        FROM document_chunks
        WHERE document_id = $1
      `,
      [document.id],
    );

    expect(Number(chunkStats.rows[0]?.chunk_count ?? 0)).toBeGreaterThan(0);
    expect(chunkStats.rows[0]?.embedding_dimensions).toBe(
      DEFAULT_EMBEDDING_DIMENSION,
    );

    const matches = await queryDocumentChunks({
      userId: user.id,
      question,
      documentIds: [document.id],
    });

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]?.documentId).toBe(document.id);
    expect(matches[0]?.content.toLowerCase()).toContain("supply-chain");

    const limitedMatches = await fetchRelevantChunks(question, {
      userId: user.id,
      documentIds: [document.id],
      limit: 1,
    });

    expect(limitedMatches).toHaveLength(1);
    expect(limitedMatches[0]?.id).toBe(matches[0]?.id);
  });

  it("returns no chunks for a user who does not own the ingested PDF", async () => {
    const { document } = await ingestPdfFixtureForSeededUser();
    const [otherUser] = await db
      .insert(users)
      .values({
        email: "retrieval-other@example.com",
        role: "user",
      })
      .returning();

    if (!otherUser) {
      throw new Error("Failed to create secondary user.");
    }

    const matches = await queryDocumentChunks({
      userId: otherUser.id,
      question,
      documentIds: [document.id],
    });

    expect(matches).toEqual([]);
  });
});
