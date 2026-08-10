# pgvector + Related Articles

## Goal

Implement AGENTS.md §20: enable pgvector, add an `embedding vector(1536)` column to `article_analyses`, extend the AI analysis pipeline to also generate and save an embedding for every article (backfilling existing analyzed articles that predate this column), and add a "Related Articles" section to the news details page powered by cosine-similarity search.

**In scope:** pgvector extension + schema/index/RPC function, `lib/supabase/types.ts` updates, embedding generation in `lib/ai/`, pipeline changes in `lib/pipeline/analyze.ts` (including embedding-only backfill for already-analyzed articles), `getRelatedArticles` query, and the Related Articles UI section on `app/articles/[id]/page.tsx`.

**Out of scope:** changing the existing analysis text/sentiment/framing logic, scraping, Scheduler, cron.

## Skills read

- `.agents/skills/supabase/SKILL.md` — joined-table filter gotcha (fetch embed, filter in JS — reused for the updated pending-check); RLS is enabled with no policies project-wide (service-role only, confirmed in `supabase/schema.sql`), so a `security invoker` SQL function is sufficient (no need for `security definer` — the service-role client bypasses RLS regardless of the function's security context, and `security definer` would needlessly grant public `EXECUTE`).
- `ai-sdk` skill — never trust memory for AI SDK APIs; read the bundled, version-matched docs. Confirmed in `node_modules/@ai-sdk/google/docs/15-google-generative-ai.mdx`:
  - `google.embedding('gemini-embedding-001')` factory (`node_modules/@ai-sdk/google/dist/index.d.ts:504-518`; `textEmbedding`/`textEmbeddingModel` are deprecated aliases — use `embedding`/`embeddingModel`).
  - `embed({ model, value, providerOptions: { google: { outputDimensionality, taskType } } })` from `node_modules/ai/docs/07-reference/01-ai-sdk-core/05-embed.mdx` and the Google provider's "Embedding Models" section.
  - `outputDimensionality` truncates the model's default 3072-dim output to the requested size (doc table: `gemini-embedding-001` supports custom dimensions). Cosine distance (pgvector's `<=>`) is scale-invariant (normalizes by vector magnitude internally), so a non-renormalized truncated vector is still mathematically correct for cosine search — no extra normalization step needed.
  - `taskType: 'SEMANTIC_SIMILARITY'` is the documented option for "optimized for text similarity" — the right choice for article-to-article related-content search (as opposed to asymmetric `RETRIEVAL_QUERY`/`RETRIEVAL_DOCUMENT` pairs).
- Confirmed via `node_modules/@supabase/supabase-js/dist/index.d.cts` (`GenericFunction = { Args: Record<string, unknown> | never; Returns: unknown }`, `Schema['Functions']`) that hand-authoring a `Functions` entry in `Database` gives typed `.rpc()` calls, matching this project's existing hand-authored-types convention.
- AGENTS.md §20 (exact requirements), §19 (pending-analysis check this extends), §5 (layer separation — AI vs Pipeline vs Database vs Vector), §21 (server-only secrets, joined-table gotcha), §22 (checks).

## Existing code inspected

- `supabase/schema.sql` — `article_analyses` has every §19 column, RLS enabled, no policies (service-role only). Header comment explicitly defers the `embedding` column to this task.
- `lib/supabase/types.ts` — hand-authored `Database` type; `Functions: Record<string, never>` currently (no RPCs yet).
- `lib/ai/gemini.ts` — server-only Gemini provider wrapper: `createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY })`, exports `ANALYSIS_MODEL` + `getAnalysisModel()`. Only a text-generation model factory exists; no embedding model factory yet.
- `lib/ai/analyze-article.ts` — `analyzeArticle(article)` builds a prompt, calls `generateText` + `Output.object`, retries once, computes `bias_score`, returns validated output. `raw_text` capped at 12,000 chars in the prompt.
- `lib/supabase/queries/articles.ts` — `getPendingArticleIds(limit)` selects `id, analysis:article_analyses(id)` and treats **any existing `article_analyses` row** as "not pending," filtering client-side (`analysis === null`) per the joined-table gotcha. This is the exact logic that needs to change: after this task, an article with an analysis row but `embedding IS NULL` (every article analyzed before this migration) must also count as pending, per §20's explicit backfill requirement — but it must only get an embedding, not a re-run of the full analysis. `getArticlesByIds`, `markArticleAnalyzed`, `getArticleById` (embeds `analysis:article_analyses(*)`, so `embedding` will flow through automatically once added to the schema/types), `getPublishedArticles` also present.
- `lib/supabase/queries/analyses.ts` — only `insertArticleAnalysis(input)` exists; no update helper yet (needed for the embedding-only backfill path, which must `UPDATE` an existing row rather than insert a new one).
- `lib/pipeline/analyze.ts` — `analyzeOne(article)` calls `analyzeArticle`, builds the `ArticleAnalysisInsert`, inserts, marks `analyzed_at`. `runPendingLoop`/`runExplicitIds` both drive off `getPendingArticleIds` → `Set<string>`/id list, with no per-article metadata beyond the id. This needs a second signal per pending article: "needs full analysis" vs "needs embedding backfill only."
- `app/articles/[id]/page.tsx` — already wired to real Supabase data (`getArticleById`), 404s if `!article.analysis`. Two-column layout (`lg:grid-cols-3`, main content `lg:col-span-2`, sidebar cards `lg:col-span-1`) inside `max-w-(--container-insight)`. No Related Articles section yet.
- `components/related-article-card.tsx` — **already built**, unused so far. Takes `article: NewsCardArticle` (same shape the homepage builds), renders an image/title/source/date card identical in structure to `NewsCard` but without the bias bar.
- `components/news-card.tsx` — exports `NewsCardArticle` type (`id, title, imageUrl, source, publishedAt, leftPercentage, centerPercentage, rightPercentage`).
- `app/page.tsx` — establishes the mapping convention this task reuses: fetch DB rows → map to a UI-shaped array (snake_case → camelCase) → render a `grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3` of cards, with an empty-state paragraph when the array is empty.
- `.env.example` / `.env.local` — only `GEMINI_API_KEY` exists (no `OPENAI_API_KEY`); `@ai-sdk/google` is the only AI provider package installed (confirmed in `package.json`; no `@ai-sdk/openai`).

## Decisions / assumptions

- **Embedding provider: Gemini, not OpenAI — confirmed with the user.** AGENTS.md §20 literally names OpenAI `text-embedding-3-small`, but this project already deviated from AGENTS.md's OpenAI default for the main analysis call (documented in `.env.example`). Asked the user directly; they chose to keep embeddings on Gemini for consistency (`gemini-embedding-001` via the already-installed `@ai-sdk/google`, no new dependency or credential) rather than introduce a second AI provider. `outputDimensionality: 1536` in `providerOptions.google` keeps the column exactly `vector(1536)` as §20 specifies. `.env.example`'s `GEMINI_API_KEY` comment is updated to note it now covers embeddings too.
- **Embedding input text:** `${article.title}\n\n${article.raw_text}` (title included since it carries strong topical signal), capped at 12,000 characters — mirrors `analyze-article.ts`'s existing cap for consistency, not a new arbitrary choice.
- **Backfill mechanics (§20's explicit requirement).** Change `getPendingArticleIds` → `getPendingArticles(limit): Promise<{ id: string; needsEmbeddingOnly: boolean }[]>` in `lib/supabase/queries/articles.ts`: select `id, analysis:article_analyses(id, embedding)`, pending = `analysis === null || analysis.embedding === null`, `needsEmbeddingOnly = analysis !== null`. Both `runPendingLoop` and `runExplicitIds` in `lib/pipeline/analyze.ts` build a `Map<id, needsEmbeddingOnly>` from this and pass the flag into `analyzeOne`. When `needsEmbeddingOnly` is true, `analyzeOne` only calls `embedArticle` + a new `updateArticleAnalysisEmbedding(articleId, embedding)` (UPDATE, not INSERT) then `markArticleAnalyzed` — it does **not** call `analyzeArticle` again, per §20's "without re-running the full analysis." When false (no row at all), it runs the existing full-analysis path plus embedding generation, and the embedding is included directly in the `ArticleAnalysisInsert`. `markArticleAnalyzed` re-sets `analyzed_at` on backfill too — harmless (nothing reads `analyzed_at`'s exact value, only its nullness, and `getPublishedArticles`/homepage ordering uses `published_at`).
- **Full-analysis + embedding run concurrently** (`Promise.all([analyzeArticle(article), embedArticle(article)])`) inside `analyzeOne` when both are needed — they're independent model calls, no reason to serialize and add latency.
- **Failure handling:** embedding failures are not given a bespoke retry loop — `embed()`'s built-in `maxRetries` (SDK default 2) already covers transient errors, and any thrown error is caught by `analyzeOne`'s existing try/catch and counted as `failed` (nothing partially written), consistent with how `analyzeArticle` failures are already handled. No new retry machinery invented.
- **Related-articles query needs a Postgres RPC, not a plain PostgREST filter.** PostgREST can't `order by` a raw `embedding <=> $1` expression through the JS query builder. Add a `security invoker` SQL function `match_related_articles(p_article_id uuid, p_embedding vector(1536), p_match_count int)` that joins `article_analyses` → `articles` → `sources`, filters `embedding is not null`, `article_id <> p_article_id`, `articles.analyzed_at is not null`, orders by `embedding <=> p_embedding`, limits to `p_match_count`, and returns exactly the columns the UI needs (avoids a second round-trip). `set search_path = ''` + schema-qualified table references, matching Supabase's function security guidance. `security invoker` is enough (not `security definer`) since the service-role client already bypasses RLS — no need for the function to escalate privileges, and `security definer` functions in `public` are callable by any role by default, which this avoids.
- **`getRelatedArticles(articleId, embedding)`** (exact signature from §20) lives in `lib/supabase/queries/articles.ts`, calls `.rpc('match_related_articles', ...)`, maps the snake_case RPC row shape to a small `RelatedArticleRow` type (camelCase) — mirroring the existing DB-row → UI-shape mapping convention already used in `app/page.tsx`, rather than importing a UI component type into the query layer.
- **Details page:** compute `relatedArticles` only when `article.analysis.embedding` is non-null; call `getRelatedArticles`, map `RelatedArticleRow[]` → `NewsCardArticle[]`, render a "Related Articles" heading + `RelatedArticleCard` grid below the existing two-column layout (full width), reusing the exact grid classes `app/page.tsx` already uses for visual consistency (`grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3`, heading styled `text-h2 font-semibold text-text-primary` matching the homepage's "Top News" heading). Section is omitted entirely (no heading, no empty state) when there's no embedding or zero results — no "no related articles" message, since §20 says only "do not show the section when the current article has no embedding," and an empty result set (e.g., not enough analyzed articles yet) is the same "nothing to show" case.
- **IVFFlat index `lists = 100`:** a reasonable default per pgvector's own guidance (`lists ≈ rows / 1000` for up to ~1M rows, with 100 as the common starting point for small-to-medium tables); noted in the SQL comment that it may need tuning (`ALTER INDEX ... lists = N` rebuild) once the table has significantly more rows.

## Files likely to change

**Add**

- `lib/ai/embed-article.ts` — `embedArticle(article: Article): Promise<number[]>` using `embed()` + `google.embedding('gemini-embedding-001')`.

**Add to existing**

- `lib/ai/gemini.ts` — add `EMBEDDING_MODEL = "gemini-embedding-001"`, `EMBEDDING_DIMENSIONS = 1536`, `getEmbeddingModel()` factory alongside the existing `getAnalysisModel()`.
- `lib/supabase/queries/articles.ts` — replace `getPendingArticleIds` with `getPendingArticles(limit): Promise<PendingArticleInfo[]>` (as described above); add `getRelatedArticles(articleId, embedding): Promise<RelatedArticleRow[]>`.
- `lib/supabase/queries/analyses.ts` — add `updateArticleAnalysisEmbedding(articleId: string, embedding: number[]): Promise<void>`.
- `lib/pipeline/analyze.ts` — thread `needsEmbeddingOnly` through `runPendingLoop`/`runExplicitIds`/`analyzeOne` as described; include `embedding` in the full-analysis `ArticleAnalysisInsert`.
- `lib/supabase/types.ts` — add `embedding: number[] | null` to `article_analyses` `Row` and `embedding?: number[] | null` to `Insert`; add a `match_related_articles` entry to `Functions` (typed `Args`/`Returns`).
- `supabase/schema.sql` — add `create extension if not exists "vector";`, add the `embedding vector(1536)` column to the `article_analyses` table definition, add the IVFFlat index, add the `match_related_articles` function, remove the header comment deferring this. This file stays the declarative source of truth; the live DB (already created) is updated by hand via the SQL Editor using the exact statements below.
- `app/articles/[id]/page.tsx` — fetch related articles when embedding exists, render the new section.
- `.env.example` — update the `GEMINI_API_KEY` comment to mention it's now also used for embeddings.

## Exact SQL to run in the Supabase SQL Editor (before testing)

```sql
create extension if not exists "vector";

alter table article_analyses
  add column if not exists embedding vector(1536);

create index if not exists article_analyses_embedding_idx
  on article_analyses using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

drop function if exists match_related_articles(uuid, vector, integer);

create function match_related_articles(
  p_article_id uuid,
  p_embedding vector(1536),
  p_match_count int default 5
)
returns table (
  id uuid,
  title text,
  image_url text,
  published_at timestamptz,
  source_name text,
  sentiment_label text,
  left_percentage smallint,
  center_percentage smallint,
  right_percentage smallint
)
language sql
stable
security invoker
set search_path = 'public'
as $$
  select
    a.id,
    a.title,
    a.image_url,
    a.published_at,
    s.name as source_name,
    aa.sentiment_label,
    aa.left_percentage,
    aa.center_percentage,
    aa.right_percentage
  from public.article_analyses aa
  join public.articles a on a.id = aa.article_id
  join public.sources s on s.id = a.source_id
  where aa.embedding is not null
    and aa.article_id <> p_article_id
    and a.analyzed_at is not null
  order by aa.embedding <=> p_embedding
  limit p_match_count;
$$;
```

This exact block is what `supabase/schema.sql` will also contain (as the steady-state schema, not a migration diff).

## Implementation requirements

1. `embedArticle` builds `${title}\n\n${raw_text}` (12,000-char cap on `raw_text`), calls `embed({ model: getEmbeddingModel(), value, providerOptions: { google: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType: "SEMANTIC_SIMILARITY" } } })`, returns `embedding: number[]`.
2. `getPendingArticles(limit)` returns pending articles with a `needsEmbeddingOnly` flag (as decided above), still respecting the joined-table filter gotcha (fetch embed, filter/map in JS, never `.eq()`/`.is()` on the joined column).
3. `analyzeOne` branches on `needsEmbeddingOnly`:
   - `true` → `embedArticle` → `updateArticleAnalysisEmbedding` → `markArticleAnalyzed`. No call to `analyzeArticle`.
   - `false` → `Promise.all([analyzeArticle(article), embedArticle(article)])` → `insertArticleAnalysis` (with `embedding` included) → `markArticleAnalyzed`.
4. `analyzed_at` is set only after the relevant write(s) for that branch succeed (matches §20: "Update `analyzed_at` only after both analysis and embedding are saved" for the full-analysis path; for backfill, only after the embedding UPDATE succeeds).
5. `getRelatedArticles(articleId, embedding)` calls the `match_related_articles` RPC and returns up to 5 rows, mapped to camelCase.
6. Details page shows "Related Articles" only when `article.analysis.embedding` is present and results exist; renders via the existing `RelatedArticleCard` component, unchanged.
7. Log progress consistent with existing `[analyze]` log style — e.g. distinguish `"analyzed"` vs `"backfilled embedding for"` in the per-article console line so batch runs are legible.

## Security requirements

- `GEMINI_API_KEY` stays server-only (read only in `lib/ai/gemini.ts`).
- No embedding/model calls run from browser code — `lib/ai/*` keeps `import "server-only"`.
- `match_related_articles` is `security invoker` with a pinned `search_path`, callable only via the service-role client from server code (never exposed to browser/anon calls); `getRelatedArticles` lives in a server-only query module.
- No new admin-secret or route surface — embedding generation piggybacks on the existing `POST /api/analyze` route and its existing auth guard.

## Acceptance criteria

- Running `POST /api/analyze` with no pending work backfills embeddings for every previously-analyzed article (one embedding call each, no re-analysis), then reports `analyzed: 0` on a subsequent run once backfill + all-pending work is done.
- A freshly scraped, not-yet-analyzed article gets both its analysis row and embedding saved in the same pipeline pass, with `analyzed_at` set only after both succeed.
- `article_analyses.embedding` is `vector(1536)` and populated for every row after a full run.
- Visiting `/articles/[id]` for an article with an embedding shows a "Related Articles" section with up to 5 cards, ordered by similarity, excluding the current article and any unanalyzed article.
- Visiting `/articles/[id]` for an article with no embedding (shouldn't normally happen post-backfill, but e.g. mid-migration) shows no Related Articles section at all.
- `npm run typecheck` passes with the new `Functions` entry and query/pipeline type changes.

## Checks to run

- `npm run typecheck`
- `npm run lint`
- `npm run build` (route/server-module and schema-adjacent changes touch the build)

## Manual test steps (after implementation)

1. In the Supabase Dashboard → SQL Editor, run the exact SQL block above (extension, column, index, function). Confirm `article_analyses` now has an `embedding` column (Table Editor).
2. `npm run dev`, watch the terminal for `[analyze]` logs.
3. Backfill pass: `curl -X POST http://localhost:3000/api/analyze -H "x-insight-ai-admin-secret: <your secret>"` — for each already-analyzed article you should see a `[analyze] backfilled embedding for "..."` line, not a re-analysis. Response summary's `analyzed` count reflects the backfilled rows.
4. Run it again — response should show `analyzed: 0`, `pendingFound: 0` (nothing left to backfill).
5. If you have any un-analyzed articles (or scrape a fresh one first per `prompts/006-oxylabs-scraping-pipeline.md`), re-run the same `curl` — confirm a `[analyze] analyzed "..."` line appears and the new row has a non-null `embedding` (check in Table Editor).
6. Open `http://localhost:3000/articles/<id>` for an analyzed article — confirm a "Related Articles" section appears below the main content with up to 5 cards (assuming at least one other analyzed article exists with a related-enough embedding — with very few articles in the DB you may see fewer than 5, which is expected).
