DO $$
BEGIN
  CREATE TYPE "document_chat_role" AS ENUM ('user', 'assistant');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "document_chat_messages" (
  "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY NOT NULL,
  "document_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "role" "document_chat_role" NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "document_chat_messages"
    ADD CONSTRAINT "document_chat_messages_document_id_documents_id_fk"
    FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "document_chat_messages"
    ADD CONSTRAINT "document_chat_messages_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE INDEX IF NOT EXISTS "document_chat_messages_document_created_at_idx"
  ON "document_chat_messages" ("document_id", "created_at");
CREATE INDEX IF NOT EXISTS "document_chat_messages_user_document_idx"
  ON "document_chat_messages" ("user_id", "document_id");
