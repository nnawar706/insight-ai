# INSIGHT AI

AI-powered news analysis site. It scrapes real articles from configured news sources, runs each one through Gemini for a neutral summary, sentiment, and AI-estimated political framing (left/center/right), stores everything in Supabase, and shows readers a bias-aware news feed with pgvector-powered "related articles."

Tagline: *Balanced news coverage, powered by AI.*

## What it does

1. **Scrapes** article-quality pages from configured source homepages (Oxylabs Web Scraper API), filtering out category pages, live pages, shows, ads, and other non-article content before anything is saved.
2. **Analyzes** each article with Gemini — a neutral summary, sentiment score/label, political framing (left/center/right percentages + label), confidence, framing notes, and loaded terms — validated with Zod before it's ever written to the database.
3. **Embeds** each article (Gemini `gemini-embedding-001`) and stores the vector in Supabase (pgvector) to power a "Related Articles" section via cosine similarity.
4. **Runs automatically** once a day via Vercel Cron: an Oxylabs Scheduler job scrapes each source's homepage, and a cron route processes the results and analyzes anything still pending.
5. **Displays** only analyzed articles — a card grid on the home page and a full breakdown (bias bar, AI summary, framing notes, related articles) on each article's details page — gated behind Clerk authentication.

## Tech stack

| Layer | Tech |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Components) |
| Auth | Clerk |
| Database | Supabase (Postgres + pgvector), service-role access only, RLS enabled with no policies |
| Scraping | Oxylabs Web Scraper API (Realtime) + Oxylabs Scheduler |
| HTML parsing | Cheerio |
| AI | Vercel AI SDK + Google Gemini (`gemini-3.6-flash` for analysis, `gemini-embedding-001` for embeddings) |
| Validation | Zod |
| Styling | Tailwind CSS v4, hand-rolled components (no shadcn), Poppins |
| Automation | Vercel Cron |

## Architecture

The codebase is deliberately layered so each concern stays swappable and testable in isolation:

```
app/                    Pages (Server Components) + thin API route handlers
components/             Presentational UI, reads props only — never fetches or mutates
lib/scraping/           Oxylabs clients, homepage link extraction, candidate URL
                         filtering, article parsing/cleanup
lib/pipeline/           Orchestration: scrape-to-insert, AI analysis, schedule sync,
                         scheduled-result processing — logging + typed summaries
lib/ai/                 Gemini provider, output schema, analysis + embedding calls
lib/supabase/           Service-role client, hand-authored types, per-table query
                         functions (the only code that talks to Postgres)
```

Rules that hold across the whole project:

- The UI only ever reads already-stored, already-analyzed data. It never scrapes, calls the AI, or mutates pipeline state.
- API routes are thin — they check auth, parse the body, call a `lib/pipeline` function, and return its summary. No business logic lives in a route handler.
- Every mutating route (`/api/scrape`, `/api/analyze`, `/api/oxylabs/schedules`, `/api/oxylabs/scheduled-results/process`) requires an `x-insight-ai-admin-secret` header. Read-only routes (`/api/sources`, `/api/oxylabs/schedules` GET, `/api/oxylabs/runs`) don't.
- `GET /api/cron/pipeline` is the one intentional exception to the POST-for-actions rule (Vercel Cron only sends GET); it's protected by `CRON_SECRET` instead, and that check is skipped in local dev.
- Supabase is the single source of truth. No source URLs are hardcoded in scraping logic — they're loaded from the `sources` table.
- Articles are append-only. Nothing in the pipeline deletes or overwrites an existing article row.

## Data model (Supabase)

| Table | Purpose |
| --- | --- |
| `sources` | Active news sources to scrape (homepage/section URL, parser strategy, active flag) |
| `articles` | Append-only scraped articles (URL, title, image, published date, raw text, `analyzed_at`) |
| `article_analyses` | One row per analyzed article — summary, sentiment, bias percentages/label, confidence, framing notes, loaded terms, `embedding vector(1536)` |
| `logs` | Structured run/event logs (level, event, message, JSON context) |
| `oxylabs_schedules` | One row per source's Oxylabs Scheduler schedule (schedule ID stored as `text` — see below) |
| `oxylabs_schedule_runs` | Processed/unprocessed scheduler job runs, deduped by `(schedule_id, job_id)` |

All 6 tables have Row Level Security enabled with **no policies** — every read/write goes through the server-only service-role client, never a browser-facing key.

An article only appears on the site once it has been both scraped **and** analyzed — "analyzed" means an `article_analyses` row exists, not just that `analyzed_at` is set (this distinction matters because a row can theoretically be deleted independently of the timestamp).

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in real values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Apply the schema before running anything that touches the database: paste `supabase/schema.sql` then `supabase/seed.sql` into the Supabase Dashboard → SQL Editor (this project has no CLI/migration tooling wired up — schema changes are applied by hand, in order).

### Environment variables

See `.env.example` for the full list with inline comments. Summary:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_*_URL` | Clerk auth |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase (service role is server-only) |
| `OXY_WSA_USERNAME`, `OXY_WSA_PASSWORD` | Oxylabs Web Scraper API + Scheduler auth |
| `GEMINI_API_KEY` | Gemini analysis calls **and** embeddings |
| `INSIGHT_AI_ADMIN_SECRET` | Shared secret required on every mutating API route |
| `ANALYSIS_BATCH_SIZE` | Optional, articles analyzed per batch (default 5) |
| `CRON_SECRET` | Injected automatically by Vercel — do **not** add to `.env.local` |

## Running the pipeline manually

Every mutating call needs the admin secret header.

```bash
# See which sources are configured
curl http://localhost:3000/api/sources

# Scrape (defaults to all active sources, 5 articles each)
curl -X POST http://localhost:3000/api/scrape \
  -H "x-insight-ai-admin-secret: $INSIGHT_AI_ADMIN_SECRET" \
  -H "Content-Type: application/json" -d '{}'

# Analyze everything pending (summary, sentiment, framing, embedding)
curl -X POST http://localhost:3000/api/analyze \
  -H "x-insight-ai-admin-secret: $INSIGHT_AI_ADMIN_SECRET" \
  -H "Content-Type: application/json" -d '{}'
```

Watch the terminal running `npm run dev` — every step (per-source progress, per-article analysis, final summary) is logged there.

### Automatic pipeline (once daily, Vercel Hobby plan)

```bash
# One-time setup: create an Oxylabs schedule per active source
curl -X POST http://localhost:3000/api/oxylabs/schedules \
  -H "x-insight-ai-admin-secret: $INSIGHT_AI_ADMIN_SECRET"
```

After that, `vercel.json` registers a daily cron hitting `/api/cron/pipeline`, which processes whatever Oxylabs scraped that day and analyzes pending articles — no manual intervention required. (Vercel's free Hobby plan caps cron jobs at once/day, which is why this isn't hourly.)

## Checks

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run build        # next build — production build, catches anything typecheck/lint miss
```

## Project structure notes

- `AGENTS.md` is the governing spec for this project — every feature was implemented by first writing a detailed prompt file under `prompts/` (goal, decisions, files touched, acceptance criteria, test steps), getting it approved, then implementing strictly to that prompt. The numbered files in `prompts/` are a chronological build log of the whole project and are worth reading if you want the *why* behind a decision, not just the *what*.
- `.agents/skills/` holds the reference skills (`clerk`, `supabase`, `oxylabs-web-scraper`/`web-scraper-api`, `ai-sdk`) consulted before implementing each area — the project intentionally avoids inventing patterns those skills already cover.

## Things learned building this

A few non-obvious lessons from actually shipping this pipeline, worth remembering for similar projects:

- **Large integer IDs silently corrupt through `JSON.parse`.** Oxylabs' `schedule_id` and job `id` values are 64-bit integers that exceed `Number.MAX_SAFE_INTEGER`. `JSON.parse` truncates the trailing digits without ever throwing — the bug only shows up later as "Oxylabs doesn't recognize this ID." The fix is to regex the raw response text for the digit sequence *before* any `JSON.parse` call, and never round-trip the ID through a JS number.
- **A LEFT JOIN is a better "pending" check than a nullable timestamp.** Originally tempting to detect pending analysis via `analyzed_at IS NULL`, but that flag can go stale (e.g. if an `article_analyses` row is deleted independently). Checking "does a matching `article_analyses` row exist at all" is the actual source of truth — and that same LEFT JOIN model made it trivial to later extend "pending" to also mean "has an analysis row but no embedding," powering a clean backfill path when pgvector was added.
- **Supabase's PostgREST can't filter on a joined table's column via `.eq('table.column', value)`** — it silently generates broken SQL. The fix is to fetch the embedded relation unfiltered and filter in JavaScript after the query returns. This one gotcha shaped several query functions across the project.
- **AI provider docs bundled in `node_modules` beat memory.** `generateObject`/`streamObject` were deprecated mid-project in AI SDK 6 in favor of `generateText` with `output: Output.object({ schema })` — a detail only caught by reading `node_modules/ai/docs/` for the actually-installed version instead of relying on training-data knowledge of the SDK.
- **Model availability drifts faster than docs.** A model that appears in `ListModels` for a given API key can still be rejected at call time ("no longer available to new users"). Worth a live smoke-test call before committing to a model ID, not just a docs check.
- **Cosine distance is scale-invariant**, so truncating a Gemini embedding's output dimensionality (3072 → 1536, to match a fixed `vector(1536)` column) doesn't need a manual renormalization step — pgvector's `<=>` operator already normalizes by vector magnitude.
- **Platform limits can force a spec deviation.** AGENTS.md called for hourly scraping + cron, but Vercel's Hobby plan caps cron jobs at once per day. Rather than silently working around it, the right move was surfacing the constraint, matching the Oxylabs schedule cadence to the actual processing cadence (so scrape jobs don't pile up unprocessed and inflate the bill), and documenting the one-line change needed if the plan is ever upgraded.
- **A written prompt-then-approve workflow pays for itself on solo AI-assisted projects.** Recording *why* a decision was made (e.g. "dropped the multi-outlet source-count card because this project analyzes single-source articles, not clustered stories") in a committed prompt file prevents the same tradeoff from being silently re-litigated or reversed by accident in a later session.
