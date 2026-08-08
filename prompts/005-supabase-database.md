# 005 — Supabase Database & Data Access

## Goal

Stand up the Supabase persistence layer for insight-ai: the six core tables from `AGENTS.md` section 7 (`sources`, `articles`, `article_analyses`, `logs`, `oxylabs_schedules`, `oxylabs_schedule_runs`) as a committed `supabase/schema.sql`, a separate `supabase/seed.sql` with 5 initial sources, hand-authored `lib/supabase/types.ts`, a server-only service-role client, and a thin typed data-access (query) layer per table. No UI wiring, scraping, AI analysis, or Oxylabs API calls in this pass — those are separate future prompts that will import this layer.

## Skills read

- `.agents/skills/supabase/SKILL.md` — core principles, security checklist, schema-change workflow: verify against changelog before implementing; enable RLS on every table in an exposed schema; never expose the service-role key to the browser; newly created tables may not be auto-exposed to the Data API (kept deliberately unexposed here — read via service role only); the joined-table filter gotcha; pin package versions and commit the lockfile.

## Existing code inspected

- `package.json` — Next.js **16.3.0**, React 19.2.8, Tailwind v4. No `@supabase/supabase-js` installed yet.
- `.env.local` — already contains `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PASSWORD` (a Supabase project is already provisioned; `SUPABASE_PASSWORD` is a dashboard/CLI credential, not an app env var). `.env.example` currently lists Clerk vars only.
- No `supabase/` directory, no `lib/supabase/` directory, no Supabase CLI on PATH, no `.mcp.json` and no Supabase MCP tools available in this session → schema must be applied by the user via the Supabase Dashboard → SQL Editor, per `AGENTS.md` section 7's explicit instruction.
- `lib/sample-articles.ts` — the `SampleArticle` shape the UI currently renders (title, imageUrl, category, location, source, publishedAt, sentimentLabel, biasLabel, left/center/right percentage, confidence, summary, bodyParagraphs, framingNotes, loadedTerms, disclaimer). Confirms the `article_analyses` field set from section 7/19 lines up with what the UI will eventually need — but this file is **not touched** in this pass.
- `app/page.tsx`, `app/articles/[id]/page.tsx` — Server Components, no `"use client"`, currently import `sampleArticles` directly. Left untouched in this pass; wiring them to real Supabase queries is a separate future prompt once there's real analyzed data to point at.
- `components/news-card.tsx`, `bias-analysis-card.tsx`, `ai-summary-card.tsx`, `bias-bar.tsx`, `framing-notes-card.tsx`, `related-article-card.tsx`, `sentiment-badge.tsx` — flat under `components/`, all consume `SampleArticle`. Untouched in this pass.
- `node_modules/server-only` — already present as a transitive dependency, usable to guard the service-role client from ever being imported into client code.

## Decisions / assumptions

1. **Scope: schema + data access only, no UI wiring (user-confirmed).** `app/page.tsx`, `app/articles/[id]/page.tsx`, and the components under `components/` are not touched here. Swapping them off `sample-articles.ts` onto real queries is a separate follow-up prompt, once scraping/analysis exist to populate real rows.
2. **Seed sources (user-confirmed):** ship `supabase/seed.sql` separate from `schema.sql`, inserting 5 active sources — Reuters, NPR, Fox News, BBC News, The Guardian — using real homepage entry URLs (not sub-pages), with `on conflict (listing_url) do nothing` so it's safe to re-run.
3. **No RLS policies, RLS enabled on every table.** Per the skill's security checklist and `AGENTS.md` ("Do not use Supabase Auth"), all 6 tables get `alter table ... enable row level security` with **zero** policies — denies `anon`/`authenticated` entirely. All app access goes through the service-role client (bypasses RLS), used only in server-side code, never the browser. Defense-in-depth in case these tables are ever exposed via the Data API.
4. **Single server-only client (service role), no anon client yet.** Every page in this app is a Server Component and every mutation route requires the admin secret (section 15) — nothing currently needs a browser-side Supabase client or an RLS-scoped anon client. `NEXT_PUBLIC_SUPABASE_ANON_KEY` stays unused for now.
5. **`logs` table redesigned as a structured event log**, not one-row-per-run: `level` (`debug`/`info`/`warn`/`error`), `event` (short slug, e.g. `scrape_started`, `source_completed`, `run_summary`), `message`, `context jsonb` (arbitrary structured detail — e.g. the section 9 summary object goes in `context` on a `run_summary` event), optional `source_id` / `article_id` FKs (nullable, `on delete set null`). This matches section 9's actual shape better than a single summary-per-run row: many log lines happen during a run ("scrape started", "homepage fetched", "candidates found", ...) plus one final summary object — this table can hold both, and supports the future `GET /api/logs` read route (section 14) with useful filters.
6. **Oxylabs `schedule_id` / job `id` stored as `text`, not a numeric type.** Section 18 says these 64-bit IDs blow past `Number.MAX_SAFE_INTEGER` and get corrupted by `JSON.parse`. Storing as Postgres `bigint` doesn't fix this — PostgREST still serializes `bigint` to a JSON number when the row is read back through `supabase-js`, silently reintroducing the same precision loss. `text` avoids that entirely, at both write and read time.
7. **No `cron` column on `oxylabs_schedules` and no natural-key FK on `oxylabs_schedule_runs`.** Section 18 requires fetching the *live* Oxylabs Scheduler API docs before implementing scheduler behavior — the exact run/job response shape (and whether a fixed cadence needs its own column at all, since the pipeline is always hourly) isn't something to guess at in a schema-only pass. `oxylabs_schedule_runs.schedule_id` references `oxylabs_schedules(id)` (the `uuid` surrogate key), consistent with every other FK in this schema, not the Oxylabs-side text ID. The future scheduler prompt can `ALTER TABLE` to add anything the live docs turn out to require.
8. **Percentage/score constraints enforced at the DB level too**, not just in the future Zod validation (section 19): `left/center/right_percentage` are `smallint` with a `CHECK` that they sum to exactly 100; `sentiment_score`/`bias_score` are `numeric(4,3)` checked to `[-1, 1]`; `confidence` is `numeric(4,3)` checked to `[0, 1]`. Defense-in-depth — bad rows can't land in the DB even if application validation is bypassed.
9. **`article_analyses.article_id` is `unique`** (one analysis per article — matches section 19's LEFT JOIN pending-detection model, where "pending" means no `article_analyses` row exists for that article).
10. **`embedding vector(1536)` is explicitly excluded from `schema.sql`**, per section 7 and section 20 — added later via a standalone `ALTER TABLE` once pgvector is enabled and AI analysis is working.
11. **No `getPendingAnalysisArticles`, no related-articles/cosine query in this pass.** Those are section 19 and section 20 concerns tightly coupled to the analysis pipeline (batch size, retry-once-then-fail, embedding backfill) — added in the `ai-analysis` and pgvector prompts, on top of this data-access layer.
12. **Types are hand-authored**, not generated via `supabase gen types` — no CLI/MCP link to the project is available in this environment. `lib/supabase/types.ts` mirrors `schema.sql` exactly (Row/Insert/Update per table, matching Supabase's generated-types shape) so it can be swapped for a real generated file later without changing call sites.

## Files likely to change

- `package.json` / `package-lock.json` — add `@supabase/supabase-js`
- `supabase/schema.sql` — new, full DDL for all 6 tables
- `supabase/seed.sql` — new, 5 initial sources
- `lib/supabase/types.ts` — new, hand-authored `Database` type
- `lib/supabase/server-client.ts` — new, server-only service-role client factory
- `lib/supabase/queries/sources.ts` — new
- `lib/supabase/queries/articles.ts` — new
- `lib/supabase/queries/analyses.ts` — new
- `lib/supabase/queries/logs.ts` — new
- `lib/supabase/queries/oxylabs.ts` — new
- `.env.example` — add the Supabase rows from the section 21 table (no real values)

Not changed: `app/page.tsx`, `app/articles/[id]/page.tsx`, anything in `components/`, `lib/sample-articles.ts`.

## Implementation requirements

### `supabase/schema.sql`

```sql
-- insight-ai database schema
-- Source of truth. Apply via Supabase Dashboard -> SQL Editor.
-- The `embedding vector(1536)` column on article_analyses is added later (AGENTS.md section 20).

create extension if not exists "pgcrypto";

-- sources --------------------------------------------------------------
create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  listing_url text not null unique,
  parser_strategy text,
  is_active boolean not null default true,
  logo_url text,
  created_at timestamptz not null default now()
);

alter table sources enable row level security;

-- articles (append-only; section 10) --------------------------------------
create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references sources(id) on delete restrict,
  url text not null unique,
  canonical_url text,
  title text not null,
  image_url text not null,
  published_at timestamptz not null,
  raw_text text not null,
  scraped_at timestamptz not null default now(),
  analyzed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists articles_source_id_idx on articles (source_id);
create index if not exists articles_analyzed_at_idx on articles (analyzed_at);
create index if not exists articles_published_at_idx on articles (published_at desc);

alter table articles enable row level security;

-- article_analyses (one per article; section 19) ---------------------------
create table if not exists article_analyses (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null unique references articles(id) on delete cascade,
  summary text not null,
  sentiment_score numeric(4,3) not null check (sentiment_score between -1 and 1),
  sentiment_label text not null check (sentiment_label in ('positive','neutral','negative')),
  bias_score numeric(4,3) not null check (bias_score between -1 and 1),
  bias_label text not null check (bias_label in ('left','center','right','mixed','unclear')),
  left_percentage smallint not null check (left_percentage between 0 and 100),
  center_percentage smallint not null check (center_percentage between 0 and 100),
  right_percentage smallint not null check (right_percentage between 0 and 100),
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  framing_notes text not null,
  loaded_terms text[] not null default '{}',
  disclaimer text not null,
  model text not null,
  created_at timestamptz not null default now(),
  constraint article_analyses_percentages_sum_100
    check (left_percentage + center_percentage + right_percentage = 100)
);

alter table article_analyses enable row level security;

-- logs (section 9 run logging) ---------------------------------------------
create table if not exists logs (
  id uuid primary key default gen_random_uuid(),
  level text not null default 'info' check (level in ('debug','info','warn','error')),
  event text not null,
  message text,
  context jsonb,
  source_id uuid references sources(id) on delete set null,
  article_id uuid references articles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists logs_created_at_idx on logs (created_at desc);
create index if not exists logs_event_idx on logs (event);

alter table logs enable row level security;

-- oxylabs_schedules (section 18; ids stored as text — see decision 6) --------
create table if not exists oxylabs_schedules (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null unique references sources(id) on delete cascade,
  oxylabs_schedule_id text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table oxylabs_schedules enable row level security;

-- oxylabs_schedule_runs (section 18) -----------------------------------------
create table if not exists oxylabs_schedule_runs (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references oxylabs_schedules(id) on delete cascade,
  oxylabs_run_id text,
  oxylabs_job_id text not null,
  result_status text not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (schedule_id, oxylabs_job_id)
);

create index if not exists oxylabs_schedule_runs_schedule_id_idx on oxylabs_schedule_runs (schedule_id);

alter table oxylabs_schedule_runs enable row level security;
```

### `supabase/seed.sql`

```sql
-- insight-ai initial sources
-- Run after schema.sql. Homepage entry URLs only (AGENTS.md section 9) — never sub-pages.

insert into sources (name, listing_url, parser_strategy, is_active) values
  ('Reuters', 'https://www.reuters.com/', 'reuters', true),
  ('NPR', 'https://www.npr.org/', 'npr', true),
  ('Fox News', 'https://www.foxnews.com/', 'fox', true),
  ('BBC News', 'https://www.bbc.com/news', 'bbc', true),
  ('The Guardian', 'https://www.theguardian.com/us', 'guardian', true)
on conflict (listing_url) do nothing;
```

### `lib/supabase/types.ts`

Hand-authored `Database` type mirroring the schema above exactly, in Supabase's generated-types shape (`Database.public.Tables.<table>.{Row,Insert,Update}`), plus convenience row-type aliases (`Source`, `Article`, `ArticleAnalysis`, `Log`, `OxylabsSchedule`, `OxylabsScheduleRun`) and matching `*Insert` aliases exported for use by the query layer and, later, feature code. `Insert` types mark all `default`-having/nullable columns optional; `Update` types make every column optional. `context` on `logs` is typed as `Json | null`; `loaded_terms` is `string[]`.

### `lib/supabase/server-client.ts`

```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  }
  return createClient<Database>(url, serviceKey, { auth: { persistSession: false } });
}
```

One factory function (not a singleton) so each server-side call site gets a fresh client — cheap for `supabase-js` and avoids any accidental cross-request state. Throws at import time in any client bundle via the `server-only` guard; throws at call time if env vars are missing.

### `lib/supabase/queries/*.ts`

Thin, typed, single-purpose functions — each opens its own client via `createServiceRoleClient()`, no shared business logic, no console logging (that belongs to the pipeline code that calls these later):

- **`sources.ts`**
  - `getActiveSources(): Promise<Source[]>` — `is_active = true`, ordered by `name`
  - `getAllSources(): Promise<Source[]>`
- **`articles.ts`**
  - `getExistingArticleUrls(urls: string[]): Promise<Set<string>>` — chunks input into groups of ≤15 before each `.in('url', chunk)` call (section 9's URL existence check), unions the results
  - `insertArticle(input: ArticleInsert): Promise<Article>` — single-row append insert, no upsert/delete
  - `getPublishedArticles(): Promise<(Article & { source: Source; analysis: ArticleAnalysis })[]>` — `analyzed_at not null`, joined `sources(*)` and `article_analyses!inner(*)`, ordered by `published_at desc`
  - `getArticleById(id: string): Promise<(Article & { source: Source; analysis: ArticleAnalysis | null }) | null>`
- **`analyses.ts`**
  - `insertArticleAnalysis(input: ArticleAnalysisInsert): Promise<ArticleAnalysis>`
- **`logs.ts`**
  - `insertLog(entry: LogInsert): Promise<void>` — `level` defaults to `'info'` if omitted
  - `getRecentLogs(limit?: number): Promise<Log[]>` — default limit 50, ordered `created_at desc`
- **`oxylabs.ts`**
  - `getSchedules(): Promise<OxylabsSchedule[]>`
  - `getScheduleBySourceId(sourceId: string): Promise<OxylabsSchedule | null>`
  - `upsertSchedule(sourceId: string, oxylabsScheduleId: string): Promise<OxylabsSchedule>` — upsert on `source_id`
  - `setScheduleActive(id: string, isActive: boolean): Promise<void>`
  - `insertScheduleRun(input: OxylabsScheduleRunInsert): Promise<OxylabsScheduleRun>`
  - `markRunProcessed(id: string): Promise<void>` — sets `processed_at = now()`

Joined reads (`getPublishedArticles`, `getArticleById`) must not filter on a joined table's column via `.eq('foreignTable.column', ...)` (the Supabase joined-table gotcha in `AGENTS.md` section 21) — the only filter here (`analyzed_at`) is on `articles` itself, so this doesn't apply yet, but future query additions must follow the same rule: fetch the join unfiltered, filter in JS.

### `.env.example` additions

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

(`SUPABASE_PASSWORD` is a CLI/dashboard credential, not an app env var — not added.)

## Security requirements

- `SUPABASE_SERVICE_ROLE_KEY` is read only inside `lib/supabase/server-client.ts`, guarded by `import "server-only"` — never imported by any client component.
- All 6 tables have RLS enabled with no policies — `anon`/`authenticated` get zero access; only the service-role key (server-only) can read/write.
- No secret values written into `.env.example`.
- `.env.local` is already git-ignored (blanket `.env*` rule) — not touched beyond what's already there.

## Acceptance criteria

- `supabase/schema.sql` runs cleanly (top to bottom) in the Supabase SQL Editor with no errors, creating all 6 tables with RLS enabled and no policies.
- `supabase/seed.sql` runs cleanly after `schema.sql` and inserts exactly 5 rows into `sources`; re-running it inserts 0 additional rows (idempotent).
- `npm run typecheck` and `npm run lint` pass with the new `lib/supabase/*` files in place.
- Every query function is fully typed (no `any`), imports `Database` from `lib/supabase/types.ts`, and only ever runs server-side.
- No file outside `lib/supabase/server-client.ts` reads `SUPABASE_SERVICE_ROLE_KEY` directly.
- `app/page.tsx`, `app/articles/[id]/page.tsx`, and all files under `components/` are unchanged.

## Checks to run

- `npm run typecheck`
- `npm run lint`
- `npm run build` (new server-only modules and a new dependency — confirms nothing leaks into a client bundle)

## Manual test steps

1. In the Supabase Dashboard → SQL Editor, paste and run `supabase/schema.sql`, then `supabase/seed.sql`. Confirm no errors and that `sources` has 5 rows (`select * from sources;`).
2. Run `npm run typecheck && npm run lint && npm run build` locally and confirm all three pass.
3. Add a temporary scratch script (or a quick REPL via `npx tsx`) that imports `getActiveSources` from `lib/supabase/queries/sources.ts` and logs the result — confirm it returns the 5 seeded sources with `is_active: true`. Delete the scratch script afterward.
4. Confirm `grep -r "SUPABASE_SERVICE_ROLE_KEY" lib/ app/ components/` only matches `lib/supabase/server-client.ts`.
