# Oxylabs Scheduler + Vercel Cron (automatic hourly-equivalent pipeline)

## Goal

Implement Insight AI's automatic scraping pipeline (AGENTS.md §18):

1. **Sync route** — `POST /api/oxylabs/schedules` creates one Oxylabs Scheduler schedule per active source (reusing the same homepage-fetch shape as manual scraping) and deactivates orphaned Oxylabs-side schedules no longer present in `oxylabs_schedules`.
2. **List route** — `GET /api/oxylabs/schedules` reads stored schedule rows.
3. **Manual process route** — `POST /api/oxylabs/scheduled-results/process` pulls completed Oxylabs job HTML and runs it through the existing scrape-to-insert pipeline (`runSourcePipeline`, §9) on demand.
4. **Runs read route** — `GET /api/oxylabs/runs` lists recent `oxylabs_schedule_runs` rows for status visibility.
5. **Vercel Cron config** — registers the automatic trigger.
6. **Cron pipeline route** — `GET /api/cron/pipeline`, `CRON_SECRET`-protected, chains "process scheduled results" then "analyze pending articles" so the pipeline runs with no manual intervention after one-time setup.

**In scope:** everything listed above + the Oxylabs Scheduler API client (separate from the existing Realtime client) + small additions to `lib/supabase/queries/oxylabs.ts` and `lib/supabase/queries/sources.ts` + `vercel.json`.

**Out of scope:** the manual `/api/scrape` and `/api/analyze` pipelines (§9/§16, §19 — already built and reused, not modified except where noted), pgvector (§20 — already built, `runAnalysis` already backfills embeddings and is reused as-is).

## Skills read

- `.agents/skills/web-scraper-api/SKILL.md` (the on-disk directory for AGENTS.md §3's `oxylabs-web-scraper`) — Realtime endpoint already used by `lib/scraping/oxylabs.ts`; this task adds the **Scheduler** surface on `data.oxylabs.io`, not covered by this skill file (it only documents Realtime `/v1/queries` and Push-Pull batch submission). Confirmed via live docs fetch below, per AGENTS.md §18's explicit instruction to consult current docs before implementing Scheduler.
- `.agents/skills/supabase/SKILL.md` — service-role-only client, joined-table filter gotcha (never `.eq('foreignTable.col', v)` — filter joined data in JS instead), verify writes after implementing.
- **Live Oxylabs docs fetched this session** (`https://developers.oxylabs.io/products/web-scraper-api/features/scheduler` + a Push-Pull results lookup):
  - `POST https://data.oxylabs.io/v1/schedules` — body `{ cron, items: [...], end_time }` (all required; `end_time` format `YYYY-MM-DD HH:MM:SS`, inclusive, no documented max). Response includes `schedule_id` (large int).
  - `GET https://data.oxylabs.io/v1/schedules` — returns the full list of existing schedule IDs (large ints; exact envelope shape undocumented, see decision below on raw-text extraction).
  - `GET https://data.oxylabs.io/v1/schedules/{id}/runs` — `{ runs: [{ run_id, jobs: [{ id, create_status_code, result_status, created_at, result_created_at }], success_rate }] }`. `result_status` ∈ `"done" | "failed" | "pending"`. Both `run_id` and job `id` are large ints (confirmed example: `7300439540206948353`, which exceeds `Number.MAX_SAFE_INTEGER`).
  - `GET https://data.oxylabs.io/v1/schedules/{id}/jobs` — flat array of job IDs, **no status** — per AGENTS.md §18, do not use this for processing; `/runs` is the only endpoint that exposes `result_status`.
  - `PUT https://data.oxylabs.io/v1/schedules/{id}/state` — body `{ active: boolean }`, `202` empty response. No delete endpoint exists.
  - `GET https://data.oxylabs.io/v1/queries/{job_id}/results?type=raw` — Push-Pull result fetch by job id, same envelope as Realtime (`{ results: [{ content, status_code, url, job_id }] }`); in the Realtime example `job_id` is already a JSON **string**, so this endpoint's own response is safe to `JSON.parse` directly — the precision risk is only in the **request URL**, which must be built from the raw-extracted job id string obtained from `/runs`, never from a round-tripped JS number.
- AGENTS.md §9 (shared pipeline rules, reused as-is), §14 (HTTP method rules — scheduler sync/process are `POST`, list/runs are `GET`, cron is the sole `GET`-for-mutation exception), §15 (admin secret), §18 (full section — Scheduler + automatic pipeline), §19 (pending-analysis check, batching — reused as-is), §21 (env table, security), §22 (checks).

## Existing code inspected

- **Schema already has what's needed** — `supabase/schema.sql` already defines `oxylabs_schedules` (`source_id` unique, `oxylabs_schedule_id` **text** unique — already correctly typed for 64-bit precision, `is_active`) and `oxylabs_schedule_runs` (`schedule_id`, `oxylabs_run_id`, `oxylabs_job_id` text, `result_status`, `processed_at`, unique on `(schedule_id, oxylabs_job_id)`). **No migration needed.** `lib/supabase/types.ts` already has matching `Database` types and exported `OxylabsSchedule`/`OxylabsScheduleRun` aliases.
- `lib/supabase/queries/oxylabs.ts` already has `getSchedules()`, `getScheduleBySourceId()`, `upsertSchedule()`, `setScheduleActive()`, `insertScheduleRun()`, `markRunProcessed()`. **Missing**: a lookup for an existing run row by `(scheduleId, jobId)` (needed for dedupe before insert) and a joined active-schedules-with-source query and a recent-runs list query — these need to be added, not the existing functions renamed.
- `lib/supabase/queries/sources.ts` has `getActiveSources()` / `getAllSources()` but no single-source lookup by id — needed to resolve a schedule row's `source_id` back to a full `Source` during processing.
- `lib/pipeline/scrape.ts` already exports `runSourcePipeline(source, homepageHtml, limitPerSource)` (the shared extract → filter → dedupe → detail-scrape → validate → insert engine) and `DEFAULT_LIMIT_PER_SOURCE = 5` — this is **exactly** the reusable piece §18 calls for; the scheduler process step calls it directly with Oxylabs job HTML instead of a live fetch. Do not duplicate this logic.
- `lib/pipeline/analyze.ts` already implements the full §19 pending-analysis pipeline correctly: `runAnalysis({ limit, articleIds })`, `DEFAULT_BATCH_SIZE = 5` (also overridable via `ANALYSIS_BATCH_SIZE` env var), sequential per-batch processing (not parallel bursts), LEFT-JOIN-based pending detection via `getPendingArticles` (handles both "no analysis row" and "row exists but embedding is null" per the §20 backfill case). **No changes needed** — the cron route will call `runAnalysis({ limit: DEFAULT_BATCH_SIZE })` as-is.
- `lib/scraping/oxylabs.ts` is the **Realtime** client (`fetchHtml`, `POST https://realtime.oxylabs.io/v1/queries`, `OxylabsError`, 180s timeout) — stays as-is, reused unchanged by `runSourcePipeline` for per-article detail-page fetches during scheduler processing. This task adds a **separate** Scheduler client for `data.oxylabs.io`, since it's a different endpoint family with different large-int handling needs.
- `proxy.ts` (Clerk middleware) only calls `auth.protect()` for `/articles(.*)`; `/api/*` routes pass through unauthenticated by Clerk, so every new route must guard itself (admin secret or `CRON_SECRET`) exactly like `app/api/scrape/route.ts` and `app/api/analyze/route.ts` already do.
- No `vercel.json` exists yet. No `app/api/oxylabs/` or `app/api/cron/` directories yet.
- `.env.example` already lists `CRON_SECRET` is intentionally **absent** (injected by Vercel, never in `.env.local`, per §18/§21) and `ANALYSIS_BATCH_SIZE` is already present — no `.env.example` changes needed for this task.

## Decisions / assumptions

- **Vercel plan is Hobby (free), confirmed with the user.** Hobby cron jobs can fire **at most once per day** — a `15 * * * *` (hourly) expression fails at deploy time on Hobby. This is a hard platform constraint, not a code choice. Per explicit user decision, this task deviates from AGENTS.md §18's literal "hourly" / "top of every hour" / ":15 past every hour" wording:
  - `vercel.json` cron: **`"15 6 * * *"`** — once daily at 06:15 UTC.
  - Oxylabs schedule cron: **`"0 6 * * *"`** — once daily at 06:00 UTC, 15 minutes before the pipeline route runs (same 15-minute buffer AGENTS.md specifies, just daily instead of hourly). Running Oxylabs hourly while only processing once a day would waste scrape jobs sitting unprocessed and needlessly raise the Oxylabs bill (the live docs explicitly warn Scheduler "can quickly raise your service bill") — so the Oxylabs cadence is matched to the processing cadence, not left at hourly.
  - The 06:15/06:00 UTC time itself is an arbitrary fixed slot (documented here, not user-specified); if the user wants a different time, both crons are one-line edits.
  - If the user upgrades to Pro later, both cron strings change back to `"15 * * * *"` / `"0 * * * *"` — no other code changes needed.
- **Gemini free-tier safety cap on the cron's analyze step.** Per explicit user request, the cron pipeline calls `runAnalysis({ limit: DEFAULT_BATCH_SIZE })` (5 by default, or `ANALYSIS_BATCH_SIZE` if set) instead of an unbounded run — so each automatic run analyzes at most 5 articles regardless of backlog size, keeping every cron-triggered Gemini burst small and safe for the free tier even though it now only runs once a day. **Trade-off, documented, not silently hidden:** if daily scraping produces more than 5 newly-inserted articles across all sources, the backlog grows across days rather than clearing same-day (leftover pending articles are still picked up first on the next day's run, oldest-first, since `getPendingArticles` orders by `scraped_at ascending` — no article is ever skipped, just delayed). The **manual** `POST /api/analyze` route is untouched and stays unbounded-by-default per AGENTS.md §19 ("process all pending valid articles") — the user can call it directly any time to clear backlog immediately, exactly as §18 already describes for the pre-cron-setup window ("until analysis runs, use `POST /api/analyze` manually").
- **Large-integer precision (AGENTS.md §18, critical).** Every Oxylabs Scheduler `schedule_id` / job `id` / `run_id` is read from the **raw response text** before any `JSON.parse`, never from a parsed-then-restringified JS number:
  - **Create schedule** (`POST /v1/schedules`): after `const rawText = await res.text()`, extract `schedule_id` via `/"schedule_id"\s*:\s*(\d+)/`. `JSON.parse(rawText)` is still used for the non-numeric fields (`active`, `cron`, `end_time`) since those aren't precision-sensitive.
  - **List schedules** (`GET /v1/schedules`): exact response envelope is undocumented (the fetched docs only confirm it returns schedule IDs). Extract all schedule IDs defensively via a global raw-text regex (`/\d{15,}/g` — 64-bit Oxylabs IDs are always well above 15 digits, so this can't collide with small status-type numbers) rather than assuming a specific JSON shape. This is more robust to the undocumented envelope than a brittle path-specific parse.
  - **Runs** (`GET /v1/schedules/{id}/runs`): `JSON.parse(rawText)` for the *shape* (array lengths, `result_status`, `created_at`, ordering — all precision-safe), combined with two ordered raw-text regex passes (`/"run_id"\s*:\s*(\d+)/g` and `/"id"\s*:\s*(\d+)/g`, the latter scoped to appear only inside `jobs` in this response) to recover the exact digit strings **in document order**, then zipped back onto the parsed structure positionally (parsed array/object *shape* is trustworthy; only the numeric *values* of large fields are corrupted by `JSON.parse`). Returns `{ runId: string; jobs: { id: string; resultStatus: string }[] }[]`.
  - **Job results fetch** (`GET /v1/queries/{job_id}/results`): the `{job_id}` path segment is built directly from the raw string obtained above — never from a parsed number. The endpoint's own JSON response is safe to parse normally (its `job_id`, if present, is already string-typed per the Realtime example, and `content`/`status_code`/`url` are non-numeric-ID fields).
  - `PUT /v1/schedules/{id}/state`: `{id}` comes straight from the `oxylabs_schedule_id` **text** column already stored in Supabase — no parsing involved.
- **Sync route is idempotent, not "recreate every time."** For each active source: if `oxylabs_schedules` already has a row for that `source_id` (regardless of its local `is_active` flag), skip creating a new Oxylabs schedule — it's already running. Only sources with **no** existing row get a new `POST /v1/schedules` call + `upsertSchedule(sourceId, scheduleId)`. This matches §18's "done once per source set" framing while staying safely re-runnable.
- **Orphan deactivation compares against ALL stored IDs, not just active ones** (§18 literal wording: "compare against the IDs currently stored in `oxylabs_schedules`") — `getSchedules()` already returns unfiltered rows, used as-is for the comparison set. Any Oxylabs-side ID not in that full set gets `PUT .../state { active: false }`.
- **One Oxylabs schedule item per source** (`items: [{ source: "universal", url: source.listing_url, render: "html" }]`) — mirrors the exact body shape `lib/scraping/oxylabs.ts`'s `fetchHtml` already sends for manual scraping, for consistent rendering behavior between manual and scheduled homepage fetches.
- **`end_time`**: set to 2 years from sync time, formatted `YYYY-MM-DD HH:MM:SS` in UTC (no documented max was found in the live docs; 2 years is a conservative, clearly-bounded choice documented here for the user to shorten/extend if Oxylabs rejects it or the source list changes sooner).
- **Process route reuses `runSourcePipeline` unchanged** — for each active schedule (joined to its `Source`), fetch `/runs`, keep jobs with `result_status === "done"`, skip any `(schedule_id, job_id)` pair already present with `processed_at` set (dedupe — both the manual process route and the cron step can safely run repeatedly without reprocessing the same job), insert a new `oxylabs_schedule_runs` row for unseen job IDs, fetch that job's HTML, run it through `runSourcePipeline(source, html, DEFAULT_LIMIT_PER_SOURCE)`, then `markRunProcessed`. Aggregates the same shape of counts as `ScrapeSummary` (§9 run logging: candidates found/rejected, duplicates skipped, detail pages scraped, articles inserted/rejected/failed, rejection reasons) plus scheduler-specific counts (schedules checked, done-jobs found, already-processed skipped, newly processed). Logged via `insertLog` exactly like manual scraping's `scrape.summary`, under event `scheduled-scrape.summary`.
- **Cron route resilience (§18 step 6):** step one (process) is wrapped in try/catch; step two (analyze) always runs even if step one throws, since there may be pre-existing unanalyzed articles regardless of whether this run's scrape succeeded.
- **Cron auth:** `Authorization: Bearer ${CRON_SECRET}` header, which Vercel injects automatically on cron-triggered requests — compared against `process.env.CRON_SECRET`. Skipped entirely when `process.env.NODE_ENV === "development"` (§18: "in local development, skip the secret check"), so `curl localhost:3000/api/cron/pipeline` works for manual testing. Never reads `INSIGHT_AI_ADMIN_SECRET` for this route, and `CRON_SECRET` is never added to `.env.local` (§18/§21 — Vercel injects it at runtime on deployed environments only).
- **Function duration on Hobby:** the cron route does real work (Oxylabs job-result fetches, per-article Realtime detail-page fetches, up to 5 Gemini analysis + embedding calls). Hobby's default `maxDuration` cap without Fluid Compute is 60s, which a multi-source run could exceed. `export const maxDuration = 60;` is set on the route (the platform maximum this plan allows without Fluid Compute) so the function doesn't silently get killed by Next.js's own lower default — this is a known limitation, not solved further in this task (no chunking/queueing is added — out of scope, keep it small per AGENTS.md §22). If timeouts occur in practice, the fix is reducing source count/`limitPerSource`, not something this task builds.
- **No admin secret on `GET /api/oxylabs/schedules` or `GET /api/oxylabs/runs`** — both are read/status routes per AGENTS.md §14's explicit list, matching the existing unauthenticated `GET /api/sources` pattern.

## Files likely to change

**Add**
- `lib/scraping/oxylabs-scheduler.ts` — server-only Scheduler API client against `https://data.oxylabs.io/v1`: `createSchedule(source)`, `listOxylabsScheduleIds()`, `deactivateSchedule(oxylabsScheduleId)`, `getScheduleRuns(oxylabsScheduleId)`, `fetchJobResultHtml(jobId)`. All large-int handling (raw-text extraction) lives here, isolated from the rest of the app.
- `lib/pipeline/sync-schedules.ts` — `syncSchedules()`: loads active sources, creates missing schedules, upserts DB rows, lists Oxylabs-side IDs, deactivates orphans, logs + returns a summary.
- `lib/pipeline/process-scheduled.ts` — `processScheduledResults()`: loads active schedules+sources, walks `/runs`, dedupes against `oxylabs_schedule_runs`, fetches job HTML, calls `runSourcePipeline`, marks runs processed, logs + returns a summary. Exported for reuse by both the manual process route and the cron route.
- `app/api/oxylabs/schedules/route.ts` — `POST` (admin secret, calls `syncSchedules()`) + `GET` (no secret, calls `getSchedules()`).
- `app/api/oxylabs/scheduled-results/process/route.ts` — `POST` (admin secret, calls `processScheduledResults()`).
- `app/api/oxylabs/runs/route.ts` — `GET` (no secret, calls new `getRecentRuns(limit)`).
- `app/api/cron/pipeline/route.ts` — `GET`, `CRON_SECRET`-protected (skipped in development), `maxDuration = 60`, calls `processScheduledResults()` (try/catch) then `runAnalysis({ limit: DEFAULT_BATCH_SIZE })`, returns `{ process, analyze }`.
- `vercel.json` — `{ "crons": [{ "path": "/api/cron/pipeline", "schedule": "15 6 * * *" }] }`.

**Change**
- `lib/supabase/queries/oxylabs.ts` — add `getRunByJobId(scheduleId: string, jobId: string): Promise<OxylabsScheduleRun | null>`, `getActiveSchedulesWithSource(): Promise<(OxylabsSchedule & { source: Source })[]>`, `getRecentRuns(limit: number): Promise<OxylabsScheduleRun[]>`. Existing functions (`getSchedules`, `upsertSchedule`, `setScheduleActive`, `insertScheduleRun`, `markRunProcessed`) are reused as-is, not modified.
- `lib/supabase/queries/sources.ts` — add `getSourceById(id: string): Promise<Source | null>`.
- `lib/pipeline/types.ts` — add `SyncSchedulesSummary`, `ProcessScheduledSummary`, `CronPipelineSummary` types.

## Implementation requirements

- **Scheduler client auth/base:** same `Buffer.from(user:pass).toString("base64")` Basic Auth pattern as the existing Realtime client, against `https://data.oxylabs.io/v1`. A shared timeout (reuse `OXYLABS_TIMEOUT_MS` from `lib/scraping/oxylabs.ts` or a local equivalent) and a typed error class for Scheduler-specific failures (can extend/reuse `OxylabsError`).
- **`createSchedule(source)`:** `POST /v1/schedules` with `{ cron: "0 6 * * *", items: [{ source: "universal", url: source.listing_url, render: "html" }], end_time: <now + 2y, "YYYY-MM-DD HH:MM:SS" UTC> }`. Read `res.text()` first; regex-extract `schedule_id`; throw if not found or non-2xx status.
- **`listOxylabsScheduleIds()`:** `GET /v1/schedules`; raw-text global regex extraction of all 15+-digit tokens as described above; return `string[]`.
- **`deactivateSchedule(id)`:** `PUT /v1/schedules/{id}/state` with `{ active: false }`; treat `202`/`200` as success.
- **`getScheduleRuns(id)`:** `GET /v1/schedules/{id}/runs`; combined parse+regex zip as described above; return `{ runId: string; jobs: { id: string; resultStatus: string }[] }[]`.
- **`fetchJobResultHtml(jobId)`:** `GET /v1/queries/{jobId}/results?type=raw`; normal `JSON.parse`; return `results[0].content`; throw on missing/empty content, matching the existing Realtime client's error conventions.
- **`syncSchedules()`:** for each active source without an existing `oxylabs_schedules` row → `createSchedule` → `upsertSchedule`. Then `listOxylabsScheduleIds()`, diff against `getSchedules()`'s full ID set, `deactivateSchedule` on every ID present only on Oxylabs's side. Console-log each step (sources checked, schedules created/skipped, orphans found/deactivated) and return a `SyncSchedulesSummary`.
- **`processScheduledResults()`:** for each row from `getActiveSchedulesWithSource()` → `getScheduleRuns(row.oxylabs_schedule_id)` → flatten to `done` jobs → for each, `getRunByJobId` to dedupe (skip if a processed row already exists) → `insertScheduleRun` (unprocessed) → `fetchJobResultHtml` → `runSourcePipeline(source, html, DEFAULT_LIMIT_PER_SOURCE)` → aggregate its `SourceRunResult` into the running summary → `markRunProcessed`. Wrap each schedule's and each job's work so one failure doesn't abort the whole run (mirrors the existing manual-scrape per-source resilience). Run logging matches §9's shared rules; final summary persisted via `insertLog({ event: "scheduled-scrape.summary", ... })` and returned.
- **Cron route:** no admin-secret check, `CRON_SECRET` via `Authorization: Bearer` header compare (skip when `NODE_ENV === "development"`, `401` on mismatch otherwise), `export const maxDuration = 60;`, calls step one in try/catch (log+continue on failure), always calls step two (`runAnalysis({ limit: DEFAULT_BATCH_SIZE })`), returns `Response.json({ process, analyze })`.
- **Route handlers stay thin** — no business logic inline, matching the existing `/api/scrape` and `/api/analyze` pattern.
- **Types:** explicit return types throughout, no `any`; large-int values are `string` end-to-end (never `number`).

## Security requirements

- `OXY_WSA_USERNAME`/`OXY_WSA_PASSWORD` stay server-only (already the case) — the new Scheduler client also starts with `import "server-only"`.
- `POST /api/oxylabs/schedules` and `POST /api/oxylabs/scheduled-results/process` reject missing/invalid `x-insight-ai-admin-secret` with `401` before doing any work, identical to the existing `/api/scrape` guard.
- `GET /api/cron/pipeline` rejects missing/invalid `CRON_SECRET` with `401` in non-development environments; never checks `INSIGHT_AI_ADMIN_SECRET`; `CRON_SECRET` is read from `process.env` only, never added to `.env.local`, never exposed to the client.
- No Oxylabs Scheduler call, job-result fetch, or Gemini call ever runs from browser code — all new modules are server-only, called only from route handlers and `lib/pipeline/*`.
- Error responses from every new route never echo credentials, secrets, or raw Oxylabs auth details.

## Acceptance criteria

- `POST /api/oxylabs/schedules` (with valid admin secret) creates exactly one Oxylabs schedule per active source lacking one, upserts `oxylabs_schedules`, and deactivates any Oxylabs-side schedule not present in the table.
- `GET /api/oxylabs/schedules` returns the stored schedule rows without requiring a secret.
- `POST /api/oxylabs/scheduled-results/process` (with valid admin secret) processes all `done` jobs from active schedules not yet processed, inserting valid articles append-only via the exact same validation/cleanup/dedupe as manual scraping, and is safe to call repeatedly without reprocessing the same job.
- `GET /api/oxylabs/runs` returns recent run rows without requiring a secret.
- `GET /api/cron/pipeline` runs process-then-analyze in one call; a failure in the process step doesn't prevent the analyze step from running; each cron-triggered analyze call processes at most `DEFAULT_BATCH_SIZE` (5) articles.
- `vercel.json` registers a valid once-daily cron (deployable on the Hobby plan) hitting `/api/cron/pipeline`.
- All Oxylabs Scheduler large-int IDs (`schedule_id`, run `id`, job `id`) round-trip exactly as stored — verified by comparing the DB-stored `oxylabs_schedule_id`/`oxylabs_job_id` text values against what Oxylabs shows for the same schedule/job in its own dashboard or a direct `curl` of the raw endpoint.
- No secrets leak into responses or client bundles; `npm run typecheck`, `npm run lint`, and `npm run build` all pass.

## Checks to run

- `npm run typecheck`
- `npm run lint`
- `npm run build` (new API routes, `vercel.json`, and server modules affect the build)

## Manual test steps

Watch the terminal running `npm run dev` throughout — scrape, scheduler, and analysis progress are all logged there (AGENTS.md §17).

1. **Sync schedules (one-time setup):**
   ```bash
   curl -X POST http://localhost:3000/api/oxylabs/schedules \
     -H "x-insight-ai-admin-secret: $INSIGHT_AI_ADMIN_SECRET"
   ```
   Expect a summary with `schedulesCreated` matching the number of active sources without an existing schedule.

2. **Confirm stored schedules:**
   ```bash
   curl http://localhost:3000/api/oxylabs/schedules
   ```

3. **Re-run sync** (should now report 0 created, all skipped as already-existing) to confirm idempotency.

4. **Wait for at least one Oxylabs run to complete** (or trigger one manually from the Oxylabs dashboard if available), then process it manually:
   ```bash
   curl -X POST http://localhost:3000/api/oxylabs/scheduled-results/process \
     -H "x-insight-ai-admin-secret: $INSIGHT_AI_ADMIN_SECRET"
   ```
   Expect inserted articles matching the same content-gate rules as manual scraping; re-running immediately after should report 0 newly processed (dedupe working).

5. **Check recent runs:**
   ```bash
   curl http://localhost:3000/api/oxylabs/runs
   ```

6. **Test the cron pipeline locally** (secret check is skipped in dev):
   ```bash
   curl http://localhost:3000/api/cron/pipeline
   ```
   Expect `{ process: {...}, analyze: {...} }` with `analyze.analyzed + analyze.skipped + analyze.failed` reflecting at most `DEFAULT_BATCH_SIZE` (5) articles analyzed this run.

7. **Deploy to Vercel** and confirm `vercel.json`'s cron registers successfully (Hobby plan, once-daily) in the project's Cron Jobs dashboard tab. Confirm a real cron-triggered call to `/api/cron/pipeline` returns `401` if you try it manually without a `CRON_SECRET` header once deployed (Vercel supplies the header only on its own scheduled invocations).
