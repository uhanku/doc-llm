CREATE UNIQUE INDEX "documents_owner_id_lower_title_unique_idx"
  ON "documents" ("owner_id", lower("title"));
