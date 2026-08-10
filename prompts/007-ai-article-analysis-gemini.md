# AI Article Analysis Pipeline (Gemini)

## Goal

Implement Insight AI's **AI article analysis pipeline** — the `POST /api/analyze` action route and the layered analysis engine behind it (AGENTS.md §19), using **Google Gemini** (via the Vercel AI SDK's Google provider) instead of OpenAI. For each valid, not-yet-analyzed article it:

1. Detects pending articles via the **pending-analysis check**: a `articles` row with no matching `article_analyses` row (LEFT JOIN semantics — never `analyzed_at IS NULL` alone).
2. Processes them in configurable batches, continuing until no pending articles remain (or a caller-supplied `limit`/`articleIds` is satisfied).
3. Calls Gemini once per article to produce a structured analysis (summary, sentiment, political framing percentages + label, confidence, framing notes, loaded terms, disclaimer).
4. Validates the model output with Zod; retries once on invalid/failed output, then marks that article as failed (no bad row saved) and moves on.
5. Computes `bias_score = (right_percentage − left_percentage) / 100` and saves a valid `article_analyses` row, then sets `articles.analyzed_at`.
6. Logs neat per-article/per-batch console progress and a final summary object (analyzed / skipped / failed counts), persisted to `logs` and returned in the API response.

**In scope:** `POST /api/analyze`, the Gemini provider wrapper, the Zod output schema, the analysis pipeline orchestrator, the new Supabase query helpers it needs, and `.env.example` additions.

**Out of scope (separate tasks, do not build):** wiring the homepage/details-page UI to real Supabase data (§19's "article cards must show…" — the UI currently renders `lib/sample-articles.ts`; leaving it on sample data is intentional for this task), embeddings / pgvector / Related Articles (§20 — explicitly deferred until after this task per AGENTS.md), Oxylabs Scheduler + cron chaining (§18, step two of the cron pipeline references this route but the cron route itself is a separate task).

## Skills read

- `.agents/skills/supabase/SKILL.md` → service-role server-only client pattern already in place (`lib/supabase/server-client.ts`); **joined-table filter gotcha** (never `.eq('foreignTable.column', value)` / `.is('foreignTable.column', null)` — must fetch the embedded resource and filter in JS instead); verify writes after implementing; pin package versions + commit lockfile.
- `ai-sdk` skill → never trust memory for AI SDK APIs; read the bundled, version-matched docs in `node_modules/ai/docs/` and `node_modules/@ai-sdk/google/docs/` for the versions actually installed. Key findings from those docs (installed versions: `ai@6.0.246`, `@ai-sdk/google@3.0.104`, `zod@4.4.3`, all just added to `package.json`):
  - **`generateObject`/`streamObject` are deprecated in AI SDK 6** (`node_modules/ai/docs/08-migration-guides/24-migration-guide-6-0.mdx`, "generateObject and streamObject Deprecation"). The current pattern is `generateText` with `output: Output.object({ schema })` from `node_modules/ai/docs/03-ai-sdk-core/10-generating-structured-data.mdx`. This task uses that pattern, not `generateObject`.
  - `@ai-sdk/google`'s default provider instance `google` reads its key from `GOOGLE_GENERATIVE_AI_API_KEY` by default (`node_modules/@ai-sdk/google/docs/15-google-generative-ai.mdx`, "Provider Instance" / `apiKey` setting), but the user's `.env.local` already has a key stored under **`GEMINI_API_KEY`** — so this task uses `createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY })` instead of the bare default export, to match the env var already configured.
  - Model id: originally `gemini-2.5-flash` (current, non-preview, full object-generation support per the provider's model capability table). **Changed after implementation**: the live API rejected it for this key with `"This model models/gemini-2.5-flash is no longer available to new users"` even though it still appears in `ListModels`. Verified against `GET https://generativelanguage.googleapis.com/v1beta/models?key=...` and a live `generateContent` smoke test for this key — settled on **`gemini-3.6-flash`** (newest non-preview flash-tier model available to this key, full object-generation support per the same capability table, low latency/cost for batched per-article calls).
  - Known Google-provider schema limitation: `z.union` / `z.record` are not supported server-side ("Troubleshooting: Schema Limitations"). The output schema below avoids both.
- AGENTS.md §5 (layer separation: AI vs. Pipeline vs. Database), §14 (`POST` for actions), §15 (admin secret header), §19 (full analysis requirements — pending-analysis check, batching, validation, required saved fields, framing output rules), §21 (server-only secrets, env var table, Supabase joined-table gotcha), §22 (checks).

## Existing code inspected

- `supabase/schema.sql` → `article_analyses` already has every column §19 requires (`summary`, `sentiment_score`/`sentiment_label`, `bias_score`/`bias_label`, `left_percentage`/`center_percentage`/`right_percentage` with a `left+center+right = 100` check, `confidence`, `framing_notes`, `loaded_terms text[]`, `disclaimer`, `model`), a unique FK on `article_id`, and RLS enabled with no policies (service-role only). No `embedding` column yet (§20, later). Nothing to change here.
- `lib/supabase/types.ts` → `ArticleAnalysis`/`ArticleAnalysisInsert` types already match the schema exactly. No changes needed.
- `lib/supabase/queries/analyses.ts` → `insertArticleAnalysis(input: ArticleAnalysisInsert): Promise<ArticleAnalysis>` already exists and matches what this task needs. Reuse as-is.
- `lib/supabase/queries/articles.ts` → has `getExistingArticleUrls`, `insertArticle`, `getPublishedArticles` (filters `analyzed_at is not null`, inner-joins `article_analyses`), `getArticleById` (left-embeds `analysis:article_analyses(*)`, typed as `ArticleAnalysis | null`). **This confirms the working embed pattern for one-to-one joins** (`article_id` is `unique` in the schema, so PostgREST embeds a single nullable object, not an array) — the pending-check will reuse this exact embed shape (`analysis:article_analyses(id)`) and filter `analysis === null` in JS, per the joined-table filter gotcha. No `getPendingArticleIds`, `getArticlesByIds`, or `markArticleAnalyzed` yet — new additions.
- `lib/supabase/queries/logs.ts` → `insertLog(entry)` exists, throws on Supabase error (wrap call sites); reuse for the run summary log exactly like `lib/pipeline/scrape.ts` does.
- `lib/pipeline/scrape.ts` / `lib/pipeline/types.ts` / `app/api/scrape/route.ts` → the established project pattern this task mirrors: thin route handler → admin-secret guard → parse body → call a `lib/pipeline/*` orchestrator → `Response.json(summary)`; orchestrator does `console.info`/`console.warn`/`console.error` progress logging, builds a typed summary object, and best-effort persists it via `insertLog` (wrapped in try/catch so a logging failure doesn't fail the run).
- `package.json` → before this task: no `ai`, `@ai-sdk/google`, or `zod`. **Already installed** as part of this task's research (`npm install ai @ai-sdk/google zod`) so the bundled docs could be read; now present as `ai@^6.0.246`, `@ai-sdk/google@^3.0.104`, `zod@^4.4.3` in `dependencies`, lockfile updated.
- `.env.local` (not committed) → already has `GEMINI_API_KEY=...` and `INSIGHT_AI_ADMIN_SECRET=...` set. No `ANALYSIS_BATCH_SIZE` set (falls back to the code default of 5).
- `.env.example` → currently Clerk + Supabase + Oxylabs + admin secret only. Missing `GEMINI_API_KEY` and `ANALYSIS_BATCH_SIZE`.
- `app/page.tsx` / `app/articles/[id]/page.tsx` → both currently render `lib/sample-articles.ts` (static mock data), not Supabase queries. Confirmed out of scope above — this task only makes real analyzed rows possible; wiring the UI to `getPublishedArticles`/`getArticleById` is a separate task.
- No `lib/ai/` directory yet, no `app/api/analyze/`.

## Decisions / assumptions

- **Deviation from AGENTS.md §6/§20/§21 (OpenAI) — explicit user instruction.** The user asked for the AI article analysis pipeline to use a Gemini API key instead of OpenAI. AGENTS.md's tech stack section and env var table currently name OpenAI; this task follows the user's explicit direction and uses `@ai-sdk/google` + `GEMINI_API_KEY` for the §19 analysis call. AGENTS.md itself is left unedited (it's the project's governing instructions file, not part of this task); `.env.example` is updated to document the var actually used. §20 (pgvector embeddings, which AGENTS.md pins to OpenAI's `text-embedding-3-small` for the `vector(1536)` column) is untouched and out of scope — that's a separate future decision once embeddings are tackled.
- **Provider setup** (`lib/ai/gemini.ts`, server-only): `createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY })`, throwing a clear error if the env var is missing (mirrors `createServiceRoleClient`'s pattern in `lib/supabase/server-client.ts`). Exports `ANALYSIS_MODEL` (`gemini-3.6-flash`) and a `getAnalysisModel()` factory that builds the configured model instance.
- **Output schema** (`lib/ai/schema.ts`): Zod object with `summary` (string), `sentimentScore` (number, -1..1), `sentimentLabel` (enum), `biasLabel` (enum `left|center|right|mixed|unclear`), `leftPercentage`/`centerPercentage`/`rightPercentage` (integers 0..100), `confidence` (number 0..1), `framingNotes` (string), `loadedTerms` (array of strings), `disclaimer` (string). A `.refine()` enforces `left + center + right === 100` (the DB check constraint would reject it anyway, but failing fast here means it goes through the retry-once path instead of a raw Postgres error). No `z.union`/`z.record` (Google provider schema limitation noted above).
- **Prompt** (`lib/ai/analyze-article.ts`): instructs the model to read the article text and produce neutral, AI-estimated framing — explicitly: base the political framing on article text evidence only (never infer from source name), use `unclear`/low confidence when evidence is weak, keep the label consistent with the strongest percentage unless confidence is low or percentages are close. `raw_text` is capped at 12,000 characters in the prompt (articles are already cleaned single-article text per §13; this just bounds latency/cost on outlier long articles, not a validity gate). Uses `generateText({ model, output: Output.object({ schema }) , prompt })` per the AI SDK 6 pattern (not deprecated `generateObject`).
- **Retry-once policy** (§19): `analyzeArticle` calls the model once; on `NoObjectGeneratedError`/`NoOutputGeneratedError`/thrown error or a schema `.refine()` failure, retries exactly once; if the second attempt also fails, throws a typed `AnalysisFailedError` that the orchestrator catches and counts as `failed` (nothing is written to `article_analyses`, `analyzed_at` stays null so it's picked up again next run).
- **Pending-analysis check** (§19, joined-table gotcha, §21): `getPendingArticleIds(limit)` in `lib/supabase/queries/articles.ts` selects `id, analysis:article_analyses(id)` from `articles` ordered by `scraped_at asc`, filters client-side for `analysis === null`, and returns up to `limit` ids. This re-scans all articles each call rather than paging with a server-side filter — acceptable at this project's scale (an append-only news pipeline, not millions of rows) and keeps the query inside the documented joined-table-filter-gotcha workaround (fetch embed, filter in JS) rather than inventing a new pattern. `getArticlesByIds(ids)` then fetches the full rows (`.in('id', ids)`, single call — batch sizes here are small, well under the 15-item chunk limit that applies to the URL-existence check) for the articles actually being analyzed this round.
- **Batching** (§19): `ANALYSIS_BATCH_SIZE` env var, default `5` (matches AGENTS.md §21's documented default). The orchestrator loops: fetch up to `batchSize` pending ids (capped further by remaining `limit` if the caller passed one) → fetch those articles → analyze each **sequentially** within the batch (simplest, keeps per-article error handling and log ordering clear; batch size already bounds total request volume) → insert valid analyses + mark `analyzed_at` → log batch counts → repeat until a fetch returns zero pending ids or the `limit` is reached.
- **Manual-selection behavior** (§19: "If the user gives a limit or selected article IDs, respect that request"): `articleIds` in the request body bypasses the pending-check *selection* step (fetches exactly those ids via `getArticlesByIds`) but still skips any article that already has an `article_analyses` row (logged as `skipped`, not reprocessed) — `article_id` is unique in the schema and this task doesn't add update/upsert-on-conflict logic, so re-analysis of an already-analyzed article is out of scope. `limit` (with no `articleIds`) caps how many pending articles the run processes, still via the batch loop above.
- **Synchronous route, no polling** (mirrors §16/§17's manual-scrape style): `POST /api/analyze` runs the full batch loop in-request and returns the final summary, same as `POST /api/scrape`. No run-id/status route is added.
- **Admin secret** (§15): identical guard to `app/api/scrape/route.ts` — header `x-insight-ai-admin-secret` compared to `process.env.INSIGHT_AI_ADMIN_SECRET`; missing/invalid → `401`.
- **Server-only boundary** (§21): `lib/ai/*` and `lib/pipeline/analyze.ts` get `import "server-only"`; `GEMINI_API_KEY` and the admin secret are read from `process.env` only in server code.

## Files likely to change

**Add**

- `lib/ai/gemini.ts` — server-only Gemini provider wrapper: `createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY })`, throws if the key is missing; exports the configured model (`gemini-3.6-flash`).
- `lib/ai/schema.ts` — Zod schema (`articleAnalysisOutputSchema`) + inferred TS type for the raw model output, with the `left+center+right===100` refinement.
- `lib/ai/analyze-article.ts` — `analyzeArticle(article: Article): Promise<ArticleAnalysisOutput>`: builds the prompt, calls `generateText` + `Output.object`, retries once on failure/invalid output, computes `bias_score`, returns a fully validated payload ready for `ArticleAnalysisInsert` (minus `article_id`, added by the caller).
- `lib/pipeline/analyze.ts` — `runAnalysis(options: ManualAnalyzeOptions): Promise<AnalysisSummary>` orchestrator: batch loop described above, per-article/per-batch console logging, best-effort `insertLog` of the final summary (same wrapped try/catch style as `runManualScrape`).
- `app/api/analyze/route.ts` — thin `POST` handler: admin-secret guard → parse `{ limit?, articleIds? }` body → `runAnalysis(...)` → `Response.json(summary)`.

**Add to existing**

- `lib/supabase/queries/articles.ts` — add `getPendingArticleIds(limit: number): Promise<string[]>`, `getArticlesByIds(ids: string[]): Promise<Article[]>`, `markArticleAnalyzed(articleId: string): Promise<void>` (sets `analyzed_at = now()`). Existing exports (`getExistingArticleUrls`, `insertArticle`, `getPublishedArticles`, `getArticleById`) are untouched.
- `lib/pipeline/types.ts` — add `ManualAnalyzeOptions { limit?: number; articleIds?: string[] }` and `AnalysisSummary { status, pendingFound, analyzed, skipped, failed, durationMs }` alongside the existing scrape types.

**Change**

- `package.json` / `package-lock.json` — `ai`, `@ai-sdk/google`, `zod` already added (see above); no further changes.
- `.env.example` — add `GEMINI_API_KEY` (server-only) and `ANALYSIS_BATCH_SIZE` (optional, default 5) with a comment noting AGENTS.md §19/§21.

## Security requirements

- `GEMINI_API_KEY` is read only in `lib/ai/gemini.ts` (server-only module), never sent to the browser, never logged.
- `POST /api/analyze` requires the `x-insight-ai-admin-secret` header, same comparison style as `/api/scrape` (length check + equality, secret never in the URL).
- No AI/model calls run from browser code; the route and every module it calls are server-only (`import "server-only"`).

## Acceptance criteria

- `POST /api/analyze` with a valid admin secret and no body analyzes all currently-pending valid articles (in `ANALYSIS_BATCH_SIZE`-sized batches) and returns a summary with `analyzed`/`skipped`/`failed` counts.
- Every inserted `article_analyses` row satisfies the DB check constraints (percentages 0-100 and summing to 100, scores in range) — invalid model output never reaches an insert; it's retried once, then counted as `failed`.
- `articles.analyzed_at` is set only after a valid `article_analyses` row is successfully saved for that article.
- Re-running `POST /api/analyze` with no pending articles left returns a summary with `analyzed: 0` and does no work.
- `limit` and `articleIds` in the request body are respected as described in Decisions above.
- Missing/invalid `x-insight-ai-admin-secret` → `401`, no Gemini calls made.

## Checks to run

- `npm run typecheck`
- `npm run lint`
- (`npm run build` not expected to be needed — no config/build-affecting changes beyond a new route and lib modules — but will run it if the diff ends up touching shared config.)

## Manual test steps (after implementation)

1. Make sure at least one un-analyzed article exists (run a manual scrape first if needed: see `prompts/006-oxylabs-scraping-pipeline.md`'s test steps).
2. Start the dev server: `npm run dev`, and watch its terminal for `[analyze]`-style progress logs.
3. Run a full pending-analysis pass:
   ```bash
   curl -X POST http://localhost:3000/api/analyze \
     -H "x-insight-ai-admin-secret: $INSIGHT_AI_ADMIN_SECRET" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```
4. Run with an explicit limit:
   ```bash
   curl -X POST http://localhost:3000/api/analyze \
     -H "x-insight-ai-admin-secret: $INSIGHT_AI_ADMIN_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"limit": 2}'
   ```
5. Confirm the `401` path:
   ```bash
   curl -X POST http://localhost:3000/api/analyze -d '{}'
   ```
6. In the Supabase dashboard, verify: new `article_analyses` rows exist for the processed articles, percentages sum to 100, and `articles.analyzed_at` is set for each analyzed row.
