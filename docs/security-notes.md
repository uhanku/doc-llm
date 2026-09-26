# File and ingestion safety

- The upload route only accepts PDFs, rejects empty files, checks file extension and MIME type, and enforces a configured max upload size.
- The local storage driver resolves all writes beneath `STORAGE_LOCAL_DIR` and rejects traversal attempts.
- The S3 storage driver writes private objects by default. Keep buckets private and add signed access only when you intentionally need file delivery.
- Before production, add deeper file signature validation and malware scanning on top of the current PDF validation.
- User-submitted content will be sent to OpenRouter for embeddings and generation. Review privacy, retention, and data handling requirements for your product.

# API and abuse prevention

- Add API rate limiting and abuse controls around ingestion and query endpoints.
- Add request logging, monitoring, and alerting around worker failures and suspicious usage patterns.
- Review authorization carefully as you introduce orgs, roles, shared documents, and multi-tenant data access.

# Data protection

- Consider encryption at rest for storage and database layers.
- Consider redaction or classification for sensitive documents before sending them to third-party AI services.
- Keep the embedding dimension aligned with the configured embedding model or your retrieval layer will break.
