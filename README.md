<p align="center">
  <img src="public/icon.png" alt="GPT Runner icon" width="160" />
</p>

<p align="center"><strong>Doc LLM</strong></p>

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-000000?style=for-the-badge&logo=openai&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![S3 Compatible](https://img.shields.io/badge/S3%20Compatible-569A31?style=for-the-badge&logo=amazons3&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

This app is a Next.js document workspace for uploading PDFs, ingesting their contents, querying them with AI, and chatting per document.

# Setup

## 1. Install dependencies

```bash
npm install
```

## 2. Create the environment file

```bash
cp .env.example .env
```

Embeddings default to Ollama's OpenAI-compatible endpoint. Before running the worker, make sure
Ollama is running locally and the model is available:

```bash
ollama pull nomic-embed-text
```

Text generation defaults to OpenRouter. Set these values in `.env`:

```bash
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=your-openrouter-key
OPENROUTER_MODEL=openai/gpt-5-mini
```

To use OpenAI directly instead, set `LLM_PROVIDER=openai` and configure `OPENAI_API_KEY` plus
`OPENAI_GENERATION_MODEL`.

## 3. Start PostgreSQL with pgvector

```bash
docker compose up -d db
```

The compose setup initializes:

- `doc_llm` for the application
- `doc_llm_test` for integration tests

Optional: use Docker Compose for either the live development server or the production-style app
container:

```bash
docker compose up -d dev worker
docker compose exec dev sh
```

The `dev` service runs `npm run dev` with bind mounts for live code changes and still works as
your interactive workspace container on [http://localhost:3100](http://localhost:3100).

To run the production-style containerized app instead:

```bash
docker compose up -d prod
```

The `prod` service builds the production image target and serves the standalone app on
[http://localhost:3000](http://localhost:3000).

## 4. Run the database setup

```bash
npm run db:migrate
npm run db:seed
```

## 5. Start the web app

```bash
npm run dev -- --port 3100
```

## 6. Start the worker in another terminal

```bash
npm run worker
```

If you are using Docker Compose for local development instead, you can skip steps 5 and 6 and run:

```bash
docker compose up -d dev worker
```

If you want to validate the production-style container too, run:

```bash
docker compose up -d prod
```

## 7. Open the app in your browser

Open [http://localhost:3100](http://localhost:3100) for the local dev server.

If you are validating the production-style container instead, open
[http://localhost:3000](http://localhost:3000).

Use the seeded credentials from `.env`:

- Email: `DEMO_USER_EMAIL`
- Password: `DEMO_USER_PASSWORD`

## Fast checks

```bash
npm run lint
npm run typecheck
```

## Unit tests

These are the safest checks to run first and currently pass in the project:

```bash
npm run test:unit
```

## Live connection checks

These send small live requests to configured external services and fail if connection, auth,
routing, or response parsing fails:

```bash
npm run test:llm:connection
npm run test:openrouter:connection
npm run test:embedding:connection
npm run test:s3:connection
npm run test:live
```

`test:llm:connection` checks the app's configured generation provider. `test:openrouter:connection`
checks OpenRouter directly. `test:live` runs all live connection checks in sequence.

## Integration tests

These exercise API handlers, auth logic, and database-backed flows.

Requirements:

- PostgreSQL running
- `TEST_DATABASE_URL` reachable
- migrations available
- Ollama running at `EMBEDDING_BASE_URL`
- `nomic-embed-text` pulled in Ollama:

```bash
ollama pull nomic-embed-text
```

Command:

```bash
npm run test:integration
```

## End-to-end tests

These cover critical browser flows.

Requirements:

- dependencies installed
- database running
- migrations and seed completed
- Playwright browsers installed

Playwright loads `.env` through `playwright.config.ts` and defaults to the running dev server on
`http://127.0.0.1:3100`. If `APP_URL` or `NEXTAUTH_URL` are set in the shell, those values take
precedence.

Commands:

```bash
npx playwright install
npx playwright test
```

The full technical breakdown now lives in [docs/app-overview.md](docs/app-overview.md).
