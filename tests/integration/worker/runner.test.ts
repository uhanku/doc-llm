import { eq } from "drizzle-orm";
import { vi } from "vitest";

import { db } from "@/db/client";
import { documentChunks, documents, ingestionJobs } from "@/db/schema";
import { createDocument } from "@/lib/services/documents/repository";
import {
  createIngestionJob,
  claimNextPendingJob,
} from "@/lib/services/ingestion/jobs";
import { TextExtractionService } from "@/lib/services/ingestion/extractor";
import { IngestionProcessor } from "@/lib/services/ingestion/processor";
import { DEFAULT_EMBEDDING_DIMENSION } from "@/lib/constants";
import { runWorkerIteration } from "@/worker/runner";
import { getSeededUser } from "../../helpers/db";
import { createPdfBuffer } from "../../helpers/files";

describe("runWorkerIteration", () => {
  it("ingests a queued document from the job queue", async () => {
    const seededUser = await getSeededUser();
    const document = await createDocument({
      ownerId: seededUser.id,
      title: "Queued support note",
      originalFilename: "queued-support-note.txt",
      storageBackend: "local",
      storageKey: "documents/user-1/queued-support-note.txt",
      contentType: "text/plain",
      byteSize: 30,
      status: "queued",
    });
    const job = await createIngestionJob({
      documentId: document.id,
      createdByUserId: seededUser.id,
    });
    const processor = new IngestionProcessor({
      extractor: new TextExtractionService(),
      llm: {
        createEmbeddings: vi.fn(async (input: string[]) =>
          input.map(() =>
            Array.from({ length: DEFAULT_EMBEDDING_DIMENSION }, () => 0.1),
          ),
        ),
      } as never,
      storage: {
        backend: "local",
        putObject: vi.fn(),
        getObjectStream: vi.fn(),
        getObjectBuffer: vi
          .fn()
          .mockResolvedValue(
            Buffer.from("queued worker content for ingestion", "utf8"),
          ),
        deleteObject: vi.fn(),
        exists: vi.fn(),
        getPublicUrl: vi.fn(),
      },
    });
    const sleep = vi.fn().mockResolvedValue(undefined);
    const logger = {
      info: vi.fn(),
      error: vi.fn(),
    };

    await expect(
      runWorkerIteration({
        claimNextPendingJob,
        processor,
        sleep,
        pollIntervalMs: 10,
        logger,
      }),
    ).resolves.toEqual({ status: "processed", jobId: job.id });

    const [updatedDocument] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, document.id))
      .limit(1);
    const [updatedJob] = await db
      .select()
      .from(ingestionJobs)
      .where(eq(ingestionJobs.id, job.id))
      .limit(1);
    const storedChunks = await db
      .select()
      .from(documentChunks)
      .where(eq(documentChunks.documentId, document.id));

    expect(updatedDocument?.status).toBe("processed");
    expect(updatedDocument?.lastIngestedAt).toBeInstanceOf(Date);
    expect(updatedDocument?.metadata).toMatchObject({
      ingestion: {
        extractedAs: "text",
        objectKey: "documents/user-1/queued-support-note.txt",
        sourceContentType: "text/plain",
        chunkCount: storedChunks.length,
      },
    });
    expect(updatedJob?.status).toBe("completed");
    expect(storedChunks.length).toBeGreaterThan(0);
    expect(storedChunks[0]?.content).toContain("queued worker content");
    expect(storedChunks[0]?.metadata).toMatchObject({
      extractedAs: "text",
      objectKey: "documents/user-1/queued-support-note.txt",
    });
    expect(sleep).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("ingests a queued pdf document from the job queue", async () => {
    const seededUser = await getSeededUser();
    const document = await createDocument({
      ownerId: seededUser.id,
      title: "Queued PDF note",
      originalFilename: "queued-pdf-note.pdf",
      storageBackend: "local",
      storageKey: "documents/user-1/queued-pdf-note.pdf",
      contentType: "application/pdf",
      byteSize: 64,
      status: "queued",
    });
    const job = await createIngestionJob({
      documentId: document.id,
      createdByUserId: seededUser.id,
    });
    const processor = new IngestionProcessor({
      extractor: new TextExtractionService(),
      llm: {
        createEmbeddings: vi.fn(async (input: string[]) =>
          input.map(() =>
            Array.from({ length: DEFAULT_EMBEDDING_DIMENSION }, () => 0.1),
          ),
        ),
      } as never,
      storage: {
        backend: "local",
        putObject: vi.fn(),
        getObjectStream: vi.fn(),
        getObjectBuffer: vi.fn().mockResolvedValue(createPdfBuffer()),
        deleteObject: vi.fn(),
        exists: vi.fn(),
        getPublicUrl: vi.fn(),
      },
    });

    await expect(
      runWorkerIteration({
        claimNextPendingJob,
        processor,
        sleep: vi.fn().mockResolvedValue(undefined),
        pollIntervalMs: 10,
        logger: { info: vi.fn(), error: vi.fn() },
      }),
    ).resolves.toEqual({ status: "processed", jobId: job.id });

    const [updatedDocument] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, document.id))
      .limit(1);
    const storedChunks = await db
      .select()
      .from(documentChunks)
      .where(eq(documentChunks.documentId, document.id));

    expect(updatedDocument?.status).toBe("processed");
    expect(updatedDocument?.metadata).toMatchObject({
      ingestion: {
        extractedAs: "pdf",
        objectKey: "documents/user-1/queued-pdf-note.pdf",
        sourceContentType: "application/pdf",
        chunkCount: storedChunks.length,
      },
    });
    expect(storedChunks.length).toBeGreaterThan(0);
    expect(storedChunks[0]?.content.length).toBeGreaterThan(0);
    expect(storedChunks[0]?.metadata).toMatchObject({
      extractedAs: "pdf",
      objectKey: "documents/user-1/queued-pdf-note.pdf",
    });
  });
});
