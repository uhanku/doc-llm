import {
  getDocumentById,
  replaceDocumentChunks,
  updateDocumentStatus,
} from "@/lib/services/documents/repository";
import {
  completeIngestionJob,
  failIngestionJob,
} from "@/lib/services/ingestion/jobs";
import { chunkText } from "@/lib/services/ingestion/chunking";
import { TextExtractionService } from "@/lib/services/ingestion/extractor";
import type { LLMService } from "@/lib/services/llm/service";
import {
  getObjectStorageService,
  StorageObjectNotFoundError,
  type ObjectStorageService,
} from "@/server/storage";

class NonRetryableIngestionError extends Error {}

export class IngestionProcessor {
  constructor(
    private readonly dependencies: {
      extractor: TextExtractionService;
      llm: LLMService;
      storage?: ObjectStorageService;
    },
  ) {}

  async process(job: {
    id: number;
    documentId: number;
  }): Promise<{ chunkCount: number }> {
    const storage = this.dependencies.storage ?? getObjectStorageService();
    const document = await getDocumentById(job.documentId);

    if (!document) {
      await failIngestionJob(job.id, `Document ${job.documentId} was not found.`, {
        retryable: false,
      });
      throw new Error(`Document ${job.documentId} was not found.`);
    }

    await updateDocumentStatus({
      documentId: document.id,
      status: "processing",
    });

    try {
      const source = await storage.getObjectBuffer(document.storageKey);
      const extracted = await this.dependencies.extractor.extract({
        body: source,
        contentType: document.contentType,
        objectKey: document.storageKey,
      });
      const extractedText = extracted.text.trim();

      if (!extractedText) {
        throw new NonRetryableIngestionError("No extractable text was found in the document.");
      }

      const chunks = chunkText(extractedText).map((chunk) => ({
        ...chunk,
        metadata: {
          ...chunk.metadata,
          ...extracted.metadata,
        },
      }));
      const embeddings = await this.dependencies.llm.createEmbeddings(
        chunks.map((chunk) => chunk.content),
      );

      if (embeddings.length !== chunks.length) {
        throw new NonRetryableIngestionError(
          `Expected ${chunks.length} embeddings but received ${embeddings.length}.`,
        );
      }

      await replaceDocumentChunks(document.id, chunks, embeddings);
      await updateDocumentStatus({
        documentId: document.id,
        status: "processed",
        lastIngestedAt: new Date(),
        metadata: {
          ...document.metadata,
          ingestion: {
            ...extracted.metadata,
            chunkCount: chunks.length,
            sourceContentType: document.contentType,
          },
        },
      });
      await completeIngestionJob(job.id);

      return { chunkCount: chunks.length };
    } catch (error) {
      const failedJob = await failIngestionJob(
        job.id,
        error instanceof Error ? error.message : "Unknown ingestion error",
        {
          retryable:
            !(error instanceof StorageObjectNotFoundError) &&
            !(error instanceof NonRetryableIngestionError),
        },
      );

      await updateDocumentStatus({
        documentId: document.id,
        status: failedJob?.willRetry ? "queued" : "failed",
      });
      throw error;
    }
  }
}
