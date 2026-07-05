# App Overview

This app is a Next.js document workspace for uploading PDFs, ingesting their contents, querying them with AI, and chatting per document.

## Today, it gives you

- A Next.js app with a landing page, credentials sign-in, protected dashboard, upload page,
  document query page, and per-document chat pages
- A user-scoped document access, so dashboards, uploads, queries, and chat history stay tied to the
  authenticated owner
- PDF upload with client and server validation, configurable size limits, unique per-user titles,
  storage-backed records, and automatic ingestion job creation
- Local filesystem storage by default, plus an S3-compatible storage adapter with endpoint,
  path-style, bucket, credential, and prefix configuration
- PostgreSQL schemas for users, documents, document chunks, ingestion jobs, chat messages, and
  asynchronous chat jobs
- a worker that runs ingestion and document-chat job loops, claims queued work with
  `SKIP LOCKED`, records failures, and retries retryable ingestion errors
- PDF text extraction, chunking, embedding generation, and pgvector-backed semantic retrieval
- A library-wide document Q&A with optional PDF scoping and matched chunk scores returned with every
  answer
- A per-document chat that saves user and assistant messages, generates answers from that PDF's
  retrieved chunks, and pushes completion/failure updates over server-sent events
- An OpenAI-compatible AI layer that uses Ollama embeddings by default and can generate text through
  OpenRouter or OpenAI
- Docker Compose support for pgvector PostgreSQL, the development app, the worker, and a
  production-style app container
- Unit, integration, live connection, and Playwright end-to-end checks for auth, upload, storage,
  ingestion, retrieval, chat, and protected browser flows
