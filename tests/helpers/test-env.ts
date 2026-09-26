import "dotenv/config";

export const TEST_USER_EMAIL = "demo@example.com";
export const TEST_USER_PASSWORD = "ChangeMe123!";

function requireEnvValue(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getTestAppUrl() {
  return requireEnvValue(
    "APP_URL or NEXTAUTH_URL or PLAYWRIGHT_APP_URL",
    process.env.APP_URL ??
      process.env.NEXTAUTH_URL ??
      process.env.PLAYWRIGHT_APP_URL,
  );
}

export function getPlaywrightAppUrl() {
  return requireEnvValue(
    "PLAYWRIGHT_APP_URL or APP_URL or NEXTAUTH_URL",
    process.env.PLAYWRIGHT_APP_URL ??
      process.env.APP_URL ??
      process.env.NEXTAUTH_URL,
  );
}

export function getTestRequestUrl(pathname: string) {
  const requestBaseUrl = requireEnvValue(
    "TEST_REQUEST_BASE_URL or APP_URL or NEXTAUTH_URL",
    process.env.TEST_REQUEST_BASE_URL ??
      process.env.APP_URL ??
      process.env.NEXTAUTH_URL,
  );

  return new URL(pathname, requestBaseUrl).toString();
}

export function applyTestEnv() {
  const appUrl = getTestAppUrl();
  const nextAuthUrl = process.env.NEXTAUTH_URL ?? appUrl;
  const testDatabaseUrl = requireEnvValue(
    "TEST_DATABASE_URL or DATABASE_URL",
    process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
  );

  Object.assign(process.env, {
    NODE_ENV: "test",
    APP_URL: process.env.APP_URL ?? appUrl,
    DATABASE_URL: testDatabaseUrl,
    TEST_DATABASE_URL: process.env.TEST_DATABASE_URL ?? testDatabaseUrl,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? "test-secret",
    NEXTAUTH_URL: nextAuthUrl,
    OPENROUTER_API_KEY:
      process.env.OPENROUTER_API_KEY ?? "test-openrouter-key",
    OPENROUTER_BASE_URL:
      process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
    OPENROUTER_MODEL:
      process.env.OPENROUTER_MODEL ?? "openai/gpt-5-mini",
    OPENROUTER_EMBEDDING_MODEL:
      process.env.OPENROUTER_EMBEDDING_MODEL ??
      "openai/text-embedding-3-small",
    EMBEDDING_DIMENSION: process.env.EMBEDDING_DIMENSION ?? "1536",
    STORAGE_BACKEND:
      process.env.STORAGE_BACKEND ??
      process.env.OBJECT_STORAGE_DRIVER ??
      "local",
    STORAGE_LOCAL_DIR:
      process.env.STORAGE_LOCAL_DIR ??
      process.env.LOCAL_STORAGE_ROOT ??
      "./data/uploads",
    STORAGE_MAX_UPLOAD_SIZE_BYTES:
      process.env.STORAGE_MAX_UPLOAD_SIZE_BYTES ?? "26214400",
    WORKER_POLL_INTERVAL_MS: process.env.WORKER_POLL_INTERVAL_MS ?? "10",
    INGESTION_MAX_CHUNK_SIZE: process.env.INGESTION_MAX_CHUNK_SIZE ?? "1200",
    INGESTION_CHUNK_OVERLAP_PERCENT:
      process.env.INGESTION_CHUNK_OVERLAP_PERCENT ?? "20",
    INGESTION_QUERY_MATCH_LIMIT: process.env.INGESTION_QUERY_MATCH_LIMIT ?? "5",
    AWS_S3_FORCE_PATH_STYLE: process.env.AWS_S3_FORCE_PATH_STYLE ?? "false",
    DEMO_USER_EMAIL: process.env.DEMO_USER_EMAIL ?? TEST_USER_EMAIL,
    DEMO_USER_PASSWORD: process.env.DEMO_USER_PASSWORD ?? TEST_USER_PASSWORD,
  });
}
