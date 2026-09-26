DO $$
BEGIN
  CREATE TYPE "document_chat_job_status" AS ENUM (
    'queued',
    'processing',
    'completed',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "document_chat_jobs" (
  "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY NOT NULL,
  "document_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "user_message_id" integer NOT NULL,
  "status" "document_chat_job_status" DEFAULT 'queued' NOT NULL,
  "error" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "started_at" timestamptz,
  "completed_at" timestamptz
);

DO $$
BEGIN
  ALTER TABLE "document_chat_jobs"
    ADD CONSTRAINT "document_chat_jobs_document_id_documents_id_fk"
    FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "document_chat_jobs"
    ADD CONSTRAINT "document_chat_jobs_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "document_chat_jobs"
    ADD CONSTRAINT "document_chat_jobs_user_message_id_document_chat_messages_id_fk"
    FOREIGN KEY ("user_message_id") REFERENCES "document_chat_messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE INDEX IF NOT EXISTS "document_chat_jobs_status_created_at_idx"
  ON "document_chat_jobs" ("status", "created_at");
CREATE INDEX IF NOT EXISTS "document_chat_jobs_user_document_idx"
  ON "document_chat_jobs" ("user_id", "document_id");
CREATE INDEX IF NOT EXISTS "document_chat_jobs_user_message_id_idx"
  ON "document_chat_jobs" ("user_message_id");
