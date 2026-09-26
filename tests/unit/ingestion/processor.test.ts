import { vi } from "vitest";

import { DEFAULT_EMBEDDING_DIMENSION } from "@/lib/constants";

const mocks = vi.hoisted(() => ({
  getDocumentById: vi.fn(),
  replaceDocumentChunks: vi.fn(),
  updateDocumentStatus: vi.fn(),
  completeIngestionJob: vi.fn(),
  failIngestionJob: vi.fn(),
}));

vi.mock("@/lib/services/documents/repository", () => ({
  getDocumentById: mocks.getDocumentById,
  replaceDocumentChunks: mocks.replaceDocumentChunks,
  updateDocumentStatus: mocks.updateDocumentStatus,
}));

vi.mock("@/lib/services/ingestion/jobs", () => ({
  completeIngestionJob: mocks.completeIngestionJob,
  failIngestionJob: mocks.failIngestionJob,
}));

import { IngestionProcessor } from "@/lib/services/ingestion/processor";

describe("IngestionProcessor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("processes a document, enriches chunks, and stores ingestion metadata", async () => {
    mocks.getDocumentById.mockResolvedValue({
      id: 10,
      storageKey: "documents/user-1/file.pdf",
      contentType: "application/pdf",
      metadata: {
        uploadSource: "pdf-upload",
      },
    });
    mocks.replaceDocumentChunks.mockResolvedValue(undefined);
    mocks.updateDocumentStatus.mockResolvedValue(undefined);
    mocks.completeIngestionJob.mockResolvedValue(undefined);
    mocks.failIngestionJob.mockResolvedValue({ willRetry: false });

    const storage = {
      backend: "local" as const,
      putObject: vi.fn(),
      getObjectStream: vi.fn(),
      getObjectBuffer: vi
        .fn()
        .mockResolvedValue(Buffer.from("pdf-bytes", "utf8")),
      deleteObject: vi.fn(),
      exists: vi.fn(),
      getPublicUrl: vi.fn(),
    };
    const extractor = {
      extract: vi.fn().mockResolvedValue({
        text: "Extracted text from pdf",
        metadata: {
          extractedAs: "pdf",
          pageCount: 2,
          objectKey: "documents/user-1/file.pdf",
        },
      }),
    };
    const llm = {
      createEmbeddings: vi
        .fn()
        .mockResolvedValue([
          Array.from({ length: DEFAULT_EMBEDDING_DIMENSION }, () => 0.1),
        ]),
    };

    const processor = new IngestionProcessor({
      storage,
      extractor: extractor as never,
      llm: llm as never,
    });

    await expect(
      processor.process({
        id: 20,
        documentId: 10,
      }),
    ).resolves.toEqual({ chunkCount: 1 });

    expect(storage.getObjectBuffer).toHaveBeenCalledWith(
      "documents/user-1/file.pdf",
    );
    expect(extractor.extract).toHaveBeenCalledWith({
      body: Buffer.from("pdf-bytes", "utf8"),
      contentType: "application/pdf",
      objectKey: "documents/user-1/file.pdf",
    });
    expect(mocks.replaceDocumentChunks).toHaveBeenCalledWith(
      10,
      [
        expect.objectContaining({
          index: 0,
          content: "Extracted text from pdf",
          metadata: expect.objectContaining({
            extractedAs: "pdf",
            pageCount: 2,
            objectKey: "documents/user-1/file.pdf",
          }),
        }),
      ],
      [Array.from({ length: DEFAULT_EMBEDDING_DIMENSION }, () => 0.1)],
    );
    expect(mocks.updateDocumentStatus).toHaveBeenNthCalledWith(1, {
      documentId: 10,
      status: "processing",
    });
    expect(mocks.updateDocumentStatus).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        documentId: 10,
        status: "processed",
        lastIngestedAt: expect.any(Date),
        metadata: {
          uploadSource: "pdf-upload",
          ingestion: {
            extractedAs: "pdf",
            pageCount: 2,
            objectKey: "documents/user-1/file.pdf",
            chunkCount: 1,
            sourceContentType: "application/pdf",
          },
        },
      }),
    );
    expect(mocks.completeIngestionJob).toHaveBeenCalledWith(20);
    expect(mocks.failIngestionJob).not.toHaveBeenCalled();
  });

  it("fails without retry when the document is missing", async () => {
    mocks.getDocumentById.mockResolvedValue(null);
    mocks.failIngestionJob.mockResolvedValue({ willRetry: false });

    const processor = new IngestionProcessor({
      storage: {
        backend: "local",
        putObject: vi.fn(),
        getObjectStream: vi.fn(),
        getObjectBuffer: vi.fn(),
        deleteObject: vi.fn(),
        exists: vi.fn(),
        getPublicUrl: vi.fn(),
      },
      extractor: { extract: vi.fn() } as never,
      llm: { createEmbeddings: vi.fn() } as never,
    });

    await expect(
      processor.process({
        id: 20,
        documentId: 999,
      }),
    ).rejects.toThrow("Document 999 was not found.");

    expect(mocks.failIngestionJob).toHaveBeenCalledWith(
      20,
      "Document 999 was not found.",
      { retryable: false },
    );
    expect(mocks.updateDocumentStatus).not.toHaveBeenCalled();
  });

  it("fails without retry when no text can be extracted", async () => {
    mocks.getDocumentById.mockResolvedValue({
      id: 10,
      storageKey: "documents/user-1/file.pdf",
      contentType: "application/pdf",
      metadata: {},
    });
    mocks.updateDocumentStatus.mockResolvedValue(undefined);
    mocks.failIngestionJob.mockResolvedValue({ willRetry: false });

    const processor = new IngestionProcessor({
      storage: {
        backend: "local",
        putObject: vi.fn(),
        getObjectStream: vi.fn(),
        getObjectBuffer: vi
          .fn()
          .mockResolvedValue(Buffer.from("pdf-bytes", "utf8")),
        deleteObject: vi.fn(),
        exists: vi.fn(),
        getPublicUrl: vi.fn(),
      },
      extractor: {
        extract: vi.fn().mockResolvedValue({
          text: "   ",
          metadata: { extractedAs: "pdf" },
        }),
      } as never,
      llm: { createEmbeddings: vi.fn() } as never,
    });

    await expect(
      processor.process({
        id: 20,
        documentId: 10,
      }),
    ).rejects.toThrow("No extractable text was found in the document.");

    expect(mocks.failIngestionJob).toHaveBeenCalledWith(
      20,
      "No extractable text was found in the document.",
      { retryable: false },
    );
    expect(mocks.replaceDocumentChunks).not.toHaveBeenCalled();
    expect(mocks.updateDocumentStatus).toHaveBeenNthCalledWith(1, {
      documentId: 10,
      status: "processing",
    });
    expect(mocks.updateDocumentStatus).toHaveBeenNthCalledWith(2, {
      documentId: 10,
      status: "failed",
    });
  });

  it("fails without retry when embeddings do not match chunk count", async () => {
    mocks.getDocumentById.mockResolvedValue({
      id: 10,
      storageKey: "documents/user-1/file.pdf",
      contentType: "application/pdf",
      metadata: {},
    });
    mocks.updateDocumentStatus.mockResolvedValue(undefined);
    mocks.failIngestionJob.mockResolvedValue({ willRetry: false });

    const processor = new IngestionProcessor({
      storage: {
        backend: "local",
        putObject: vi.fn(),
        getObjectStream: vi.fn(),
        getObjectBuffer: vi
          .fn()
          .mockResolvedValue(Buffer.from("pdf-bytes", "utf8")),
        deleteObject: vi.fn(),
        exists: vi.fn(),
        getPublicUrl: vi.fn(),
      },
      extractor: {
        extract: vi.fn().mockResolvedValue({
          text: "Extracted text from pdf",
          metadata: { extractedAs: "pdf" },
        }),
      } as never,
      llm: {
        createEmbeddings: vi.fn().mockResolvedValue([]),
      } as never,
    });

    await expect(
      processor.process({
        id: 20,
        documentId: 10,
      }),
    ).rejects.toThrow("Expected 1 embeddings but received 0.");

    expect(mocks.failIngestionJob).toHaveBeenCalledWith(
      20,
      "Expected 1 embeddings but received 0.",
      { retryable: false },
    );
    expect(mocks.replaceDocumentChunks).not.toHaveBeenCalled();
    expect(mocks.updateDocumentStatus).toHaveBeenNthCalledWith(2, {
      documentId: 10,
      status: "failed",
    });
  });
});
