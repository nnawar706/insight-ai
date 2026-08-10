# Oxylabs Scraping Pipeline (manual scrape-to-insert)

## Goal

Implement Insight AI's **manual scraping pipeline** — the `POST /api/scrape` action route and the layered scrape-to-insert engine behind it (AGENTS.md §9 + §16). On demand, it:

1. Loads selected active sources from Supabase (all active by default; §8).
2. Fetches each source's **homepage HTML live through Oxylabs** (`universal` source, Realtime endpoint).
3. Extracts visible story-card links from the homepage only (§11).
4. Rejects non-article URLs via the **non-article reject list** and source-specific URL checks (§9/§11/§12).
5. Normalizes + dedupes candidates, then skips URLs already in Supabase via the **URL existence check** (≤15 per `.in()`; §9).
6. Scrapes each surviving candidate's **article detail page** through Oxylabs.
7. Validates + cleans each detail page against the **article content gate** (§13).
8. Inserts only valid articles, **append-only** (§10) — never a homepage/listing/category page.
9. Emits **run logging** during the run + a final summary object, returned in the API response and written to `logs`.

**In scope:** the manual scraping engine + `POST /api/scrape` + supporting parsing/scraping/pipeline modules + `GET /api/sources` (read route used to inspect sources per §8) + Cheerio dependency + `.env.example` additions.

**Out of scope (separate tasks, do not build):** Oxylabs Scheduler (§18), AI analysis / `POST /api/analyze` (§19), pgvector / Related Articles (§20), Vercel Cron (§18). The pipeline modules are written so the scheduler task (§18) can reuse the exact same extract → filter → dedupe → detail-scrape → validate → clean → insert → log logic, differing only in where the homepage HTML comes from.

## Skills read

- `.agents/skills/web-scraper-api/SKILL.md` + `examples.md` + `sources.md` → **the actual skill directory on disk is `web-scraper-api`, not `oxylabs-web-scraper`** (AGENTS.md §3 names it `oxylabs-web-scraper`, but that path does not exist in `.agents/skills/`; use the real directory). HTTP Basic Auth with `OXY_WSA_USERNAME:OXY_WSA_PASSWORD`; **Realtime endpoint** `POST https://realtime.oxylabs.io/v1/queries` for synchronous manual scraping; `source: "universal"` + `url` for arbitrary pages; `render: "html"` for JS-heavy pages; response shape `{ results: [{ content, status_code, url }] }` where `content` is raw HTML when `parse` is off; set client timeouts near 180s for rendered requests; 401/403/429 error handling.
- `.agents/skills/supabase/SKILL.md` → service-role server-only client already exists (`lib/supabase/server-client.ts`, see below); RLS-on / no-policies model; **joined-table filter gotcha** (never `.eq('foreignTable.col', v)`); verify writes after implementing; pin packages + commit lockfile.
- AGENTS.md §5 (layer separation), §7 (article fields required before saving), §8 (source selection), §9 (canonical pipeline + shared rules), §10 (append-only storage), §11 (homepage link extraction), §12 (candidate URL filtering), §13 (validation + cleanup), §14 (POST for scraping), §15 (admin secret header), §16 (manual scraping behavior), §17 (curl test steps), §21 (server-only secrets, env table), §22 (checks).
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` → App Router `route.ts` handlers export `POST`/`GET`; use Web `Request`/`Response.json()`; Route Handlers are not cached for POST; this is "NOT the Next.js you know" (installed Next is **16.3.0**, not 16.2.10 — verify against the docs actually bundled in `node_modules`, not memory).

## Existing code inspected

- **Data layer already built**: `supabase/schema.sql` (6 tables incl. `articles` with `url` unique dedupe key, `image_url`/`published_at` NOT NULL, `analyzed_at` nullable, and a `left+center+right = 100` check on `article_analyses`), `lib/supabase/server-client.ts` (`createServiceRoleClient()` — **not** `server.ts`/`createServiceClient()`; server-only, uses the `ws` package as a realtime transport fallback since Node 20 has no global `WebSocket`), `lib/supabase/types.ts` (hand-authored `Database` type; `Article`, `ArticleInsert`, `Source`, `LogInsert`, etc.). **There is no `lib/supabase/mappers.ts` and no `splitParagraphs` helper anywhere in the repo** — `raw_text` cleanup and paragraph splitting must be written from scratch inside the new `lib/scraping/article.ts`, not reused from an existing mapper.
- `lib/supabase/queries/sources.ts` → `getActiveSources()`, `getAllSources()` already exist — reuse for source selection.
- `lib/supabase/queries/logs.ts` → `insertLog(entry)` (**not** `createLog`; never throws internally — it does throw on a Supabase error, so wrap call sites), `getRecentLogs(limit)` already exist — reuse for the DB run log.
- `lib/supabase/queries/articles.ts` → **already has `getExistingArticleUrls(urls: string[]): Promise<Set<string>>`** (chunks ≤15, but only checks the `url` column — not `canonical_url`) **and `insertArticle(input: ArticleInsert): Promise<Article>`** (plain insert + `.select().single()`, does not currently special-case a unique-violation). Both need small extensions, not net-new functions of different names — see "Add to existing" below.
- `lib/supabase/queries/analyses.ts` and `lib/supabase/queries/oxylabs.ts` already exist (insert/query helpers for `article_analyses` and `oxylabs_schedules`/`oxylabs_schedule_runs`) — out of scope for this task (§19/§18) but present in the repo; don't recreate them.
- `supabase/seed.sql` → 5 active sources seeded: Reuters `https://www.reuters.com/`, NPR `https://www.npr.org/`, Fox News `https://www.foxnews.com/`, BBC `https://www.bbc.com/news`, The Guardian `https://www.theguardian.com/us`. `parser_strategy` is set per-source (`reuters`, `npr`, `fox`, `bbc`, `guardian`) — not null as previously assumed — so a per-host strategy switch is natural.
- `proxy.ts` → Clerk middleware; `matcher` runs on `/(api|trpc)(.*)`, but `isProtectedRoute` only matches `/articles(.*)` — `/api/scrape` is not protected by Clerk, so the route must guard itself with the admin secret (§15).
- `package.json` → Next **16.3.0**, React 19, `@supabase/supabase-js` present. **No `cheerio`, no `zod`.** This task needs **cheerio**; zod is not required here (AI-output validation is §19).
- `.env.example` → currently only Clerk + Supabase vars. Missing `OXY_WSA_USERNAME`, `OXY_WSA_PASSWORD`, `INSIGHT_AI_ADMIN_SECRET` (canonical names per AGENTS.md §21's env table and the `web-scraper-api` skill docs).
- **`.env.local` currently has the wrong keys**: `OXYLABS_WSA_USERNAME` / `OXYLABS_WSA_PASSWORD` instead of the canonical `OXY_WSA_USERNAME` / `OXY_WSA_PASSWORD`. Per user decision, the code will read the canonical names — **the user must rename these two keys in `.env.local` before testing**, or `fetchHtml` will throw a missing-credentials error.
- No `app/api/` directory yet, no `lib/scraping/`, no `lib/pipeline/`.

## Decisions / assumptions

- **Scope = manual scraping only.** Live homepage fetch via Oxylabs Realtime. Scheduler/analysis/cron are later tasks; I structure the engine so §18 reuses it (pass-in HTML vs. live-fetch HTML).
- **Oxylabs client** (`lib/scraping/oxylabs.ts`, server-only): one `fetchHtml(url)` helper → `POST https://realtime.oxylabs.io/v1/queries` with Basic Auth from `OXY_WSA_USERNAME`/`OXY_WSA_PASSWORD`, body `{ source: "universal", url, render: "html" }`, `AbortController` timeout ~180s. Returns `{ html, statusCode, finalUrl }` from `results[0]`. Throws a typed error on non-200 / empty content / auth failure. **No credentials ever reach the browser.**
- **Layer separation (§5):** distinct modules — Oxylabs calls (`lib/scraping/oxylabs.ts`), homepage link extraction (`lib/scraping/extract.ts`), candidate URL filtering (`lib/scraping/candidate-url.ts` incl. the non-article reject list), article detail parsing + cleanup (`lib/scraping/article.ts`), orchestration + logging (`lib/pipeline/scrape.ts`). The route handler stays thin (§5: "thin route handlers only").
- **Non-article reject list (§9)** lives in exactly one place: a `NON_ARTICLE_PATTERNS` constant in `lib/scraping/candidate-url.ts`, matched against URL path segments (category/section, topic/tag, author, search, nav/menu/footer, show/program/podcast, live, game, product/review/shopping, corporate/support, newsletter/subscription, video-only). Referenced, never duplicated.
- **Candidate URL check (§12):** keep a URL only if same-host as the source, not the homepage/a reject-list path, and it looks like a real article — prefer numeric article IDs, date-based paths (`/2026/07/...`), or long multi-word slugs. Per-host heuristics for the 5 seeded hosts (Reuters `/world/.../-id`, NPR `/YYYY/MM/DD/...`, Fox `/{section}/{slug}` excluding `/shows|/games|/live`, BBC `/news/...-{digits}` or `/news/articles/...` excluding `/sport|/live`, Guardian `/{section}/YYYY/mon/dd/{slug}`). When uncertain, **reject** (§12: "use the stricter choice").
- **URL existence check (§9):** extend the existing `getExistingArticleUrls(urls)` in `lib/supabase/queries/articles.ts` (currently only queries `url`) to also chunk-query `canonical_url` (still **≤15** per `.in()`), merging both into the returned `Set` of existing URLs. Never passes >15 to a single `.in()`.
- **Article content gate (§13):** validate parsed detail page — must have article-specific URL + title (not a generic/section/show name), an `image_url` (og:image / article `<img>`), a `published_at` (og/article:published_time / `<time datetime>` / JSON-LD `datePublished`), and body passing **either** ≥3 meaningful paragraphs **or** ≥900 cleaned chars. If extraction yields one big blob, split by DOM blocks/sentence boundaries before validating (§13). Reject on missing image/date, generic/section title, or body that is mostly nav/captions/ads/CSS/scripts.
- **`raw_text` cleanup (§13):** strip `<script>`/`<style>`, ad/newsletter/subscription/related/most-viewed/load-more/social-share blocks, repeated nav labels, inline JS errors, CSS class dumps; collapse whitespace; join real paragraphs with `\n\n`. Written fresh in `lib/scraping/article.ts` — there is no existing `mappers.ts`/`splitParagraphs` to reuse. Saved text reads like one article.
- **Canonical URL:** read `<link rel="canonical">` / og:url; reject if it points at a listing/category/program/product page (§13). Store both `url` (original) and `canonical_url`; dedupe on both (§10).
- **Append-only insert (§10):** insert valid articles one-by-one (or small batch) with `analyzed_at` left null; on unique-violation (`url`), skip as duplicate — never delete/replace/reset existing rows.
- **Source selection (§8/§16):** request body `{ sources?: string[] (names or ids), limitPerSource?: number }`. Default = all active sources, **5 valid articles per source**. Honor an explicit choice ("3 sources, 5 per source"). Cap candidate detail scrapes per source generously above the target so rejects don't starve the limit, but stop once `limitPerSource` valid articles are inserted for that source.
- **Admin secret (§15):** `POST /api/scrape` requires header `x-insight-ai-admin-secret` === `process.env.INSIGHT_AI_ADMIN_SECRET`; missing/invalid → `401`. Secret never in URL/query, never in browser code. Constant-time-ish compare (length + equality).
- **HTTP methods (§14):** scrape is `POST`. `GET /api/sources` is read-only (returns active source names/ids for §8 inspection) and does **not** require the admin secret.
- **Run logging (§9):** structured `console` messages through the run (scrape started, selected sources, per-source start, homepage fetched, candidate links found, candidates rejected pre-detail, duplicates skipped, detail pages scraped, articles inserted, articles rejected post-validation, source-level errors, scrape completed/failed) + a final summary object: `{ status, sourcesChecked, candidatesFound, candidatesRejected, duplicatesSkipped, detailPagesScraped, articlesInserted, articlesRejected, articlesFailed, durationMs, rejectionReasons }` (reasons grouped by count). Summary also written to `logs` via `insertLog` and returned as the API response body.
- **Resilience:** a single source failing (Oxylabs error, bad HTML) is logged and skipped; the run continues with remaining sources. Per-article failures are counted, never fatal. "Better to insert fewer good articles than bad ones" (§16).
- **Server-only boundary (§21):** every new `lib/scraping/*` and `lib/pipeline/*` module and the route are server-only; Oxylabs credentials + admin secret are read from `process.env` in server code exclusively. Add `import "server-only"` to the scraping/pipeline modules.
- **No status/polling route (§16/§17):** manual scrape is synchronous — the summary returns in the `POST /api/scrape` response. No run-id polling.

## Files likely to change

**Add**
- `lib/scraping/oxylabs.ts` — server-only Oxylabs Realtime client: `fetchHtml(url)` → `{ html, statusCode, finalUrl }`, Basic Auth, timeout, typed errors.
- `lib/scraping/extract.ts` — `extractCandidateLinks(html, source)` → visible story-card links only (Cheerio), absolutized against source host.
- `lib/scraping/candidate-url.ts` — `NON_ARTICLE_PATTERNS`, `isRejectedUrl(url)`, `isLikelyArticleUrl(url, source)`, `normalizeUrl(url)`; the single home of the non-article reject list.
- `lib/scraping/article.ts` — `parseArticle(html, url, source)` → extracted `{ title, imageUrl, publishedAt, canonicalUrl, rawText }` or a typed rejection; includes the content gate + `raw_text` cleanup helpers.
- `lib/pipeline/scrape.ts` — `runManualScrape({ sources, limitPerSource })` orchestrator: loads sources, runs the shared pipeline per source, aggregates counts/reasons, does run logging, returns the summary. Exports the reusable per-source pipeline for §18.
- `lib/pipeline/types.ts` — `ScrapeSummary`, `RejectionReason`, per-source result types (typed pipeline results, §21).
- `app/api/scrape/route.ts` — thin `POST` handler: admin-secret guard → parse body → `runManualScrape(...)` → `Response.json(summary)`.
- `app/api/sources/route.ts` — thin `GET` handler returning active sources (id, name, listing_url) for §8 inspection.

**Add to existing** (both functions already exist in `lib/supabase/queries/articles.ts` — extend in place, do not rename or duplicate)
- `getExistingArticleUrls(urls: string[]): Promise<Set<string>>` — currently only queries `.in('url', chunk)`. Extend it to also query `.in('canonical_url', chunk)` per chunk (still ≤15 per `.in()`) and merge both into the returned `Set`, so candidate dedupe catches canonical-URL matches too.
- `insertArticle(input: ArticleInsert): Promise<Article>` — currently a plain insert that throws on any Supabase error. Update the pipeline call site (not necessarily the function itself) to catch a unique-violation on `url` (Postgres error code `23505`) and treat it as a skipped duplicate rather than a fatal error, per the append-only/duplicate-safe requirement.

**Change**
- `package.json` / `package-lock.json` — add `cheerio` (pinned, lockfile committed).
- `.env.example` — add `OXY_WSA_USERNAME`, `OXY_WSA_PASSWORD`, `INSIGHT_AI_ADMIN_SECRET` (placeholders, server-only, per §21 table; canonical names, not `OXYLABS_WSA_*`).
- `.env.local` — user renames `OXYLABS_WSA_USERNAME`/`OXYLABS_WSA_PASSWORD` to `OXY_WSA_USERNAME`/`OXY_WSA_PASSWORD` before testing (not something the agent edits, since it's a local secrets file, but call it out in the test steps).

## Implementation requirements

- **Oxylabs client:** `POST https://realtime.oxylabs.io/v1/queries`, header `Authorization: Basic base64(user:pass)` + `Content-Type: application/json`, body `{ source: "universal", url, render: "html" }`. `AbortController` with ~180s timeout. Read `results[0].content` (HTML string), `results[0].status_code`, `results[0].url`. Throw typed `OxylabsError` on network error, non-200 Oxylabs response, missing/empty `content`, or `results[0].status_code` >= 400.
- **Homepage extraction:** parse with Cheerio; collect `<a href>` inside visible story/headline containers only; ignore nav/menu/footer/aside/subscription regions; absolutize relative URLs to the source host; unique-set the result before filtering.
- **Candidate filtering:** apply `normalizeUrl` (strip fragments, tracking query params, trailing slash), reject cross-host, reject homepage/reject-list paths, then `isLikelyArticleUrl`. Uncertain → reject.
- **Detail scrape + validate:** for each surviving candidate up to the per-source cap, `fetchHtml` the detail page, `parseArticle`, run the content gate, clean `raw_text`. Only on full pass, build an `ArticleInsert` (`source_id`, `url`, `canonical_url`, `title`, `image_url`, `published_at`, `raw_text`, `scraped_at`, `analyzed_at: null`) and insert append-only. Stop the source once `limitPerSource` valid inserts succeed.
- **Dedupe:** before detail-scraping a source's candidates, call `getExistingArticleUrls` (extended per above) on the normalized candidate set and drop known URLs; also skip on canonical match after parse; rely on the DB `url` unique constraint as the final guard (catch the `23505` unique-violation on `insertArticle` and count as duplicate).
- **Logging:** structured `console.info`/`console.warn`/`console.error` lines through the run + one final summary object; also persist the summary to `logs` via `insertLog({ level, event: "scrape.summary", message, context })`.
- **Route handlers:** thin; no business logic. Validate method, secret, and body shape; delegate to `lib/pipeline`. Return `Response.json(summary, { status })`. On engine throw, return `500` with a safe message (no secrets/credentials leaked).
- **Types:** explicit return types, no `any`, centralized limits (`DEFAULT_LIMIT_PER_SOURCE = 5`, `MAX_URLS_PER_IN_QUERY = 15`, `OXYLABS_TIMEOUT_MS ≈ 180000`, per-source candidate cap). Small functions.

## Security requirements

- `OXY_WSA_USERNAME`, `OXY_WSA_PASSWORD`, `INSIGHT_AI_ADMIN_SECRET` are **server-only** — read from `process.env` only in server modules; never `NEXT_PUBLIC_`, never in a client component, never in a response body. All scraping/Oxylabs modules start with `import "server-only"`.
- `POST /api/scrape` rejects missing/invalid `x-insight-ai-admin-secret` with `401` before doing any work. Secret is a header, never a query param.
- No Oxylabs call, scraping, or insert runs from browser code (§21).
- Error responses never echo credentials, the admin secret, or raw Oxylabs auth details.
- Scraping writes are append-only; the pipeline never deletes/updates existing article rows.

## Acceptance criteria

- `POST /api/scrape` with a valid `x-insight-ai-admin-secret` runs the full scrape-to-insert pipeline for the selected (or all active) sources and returns the summary JSON; server terminal shows the structured run log + final summary object.
- Missing/invalid admin secret → `401`, no scraping performed.
- Only valid article detail pages are inserted; homepages, listing/category/topic/show/live/product pages, and non-article reject-list URLs are never stored as articles.
- Duplicates (existing `url`/`canonical_url`) are skipped, not re-inserted or overwritten; existing rows are untouched (append-only).
- Every inserted article has non-empty `title`, a real `image_url`, a real `published_at`, and clean `raw_text` reading like one article; `analyzed_at` is null (analysis is §19).
- `GET /api/sources` returns the active sources for §8 inspection and requires no secret.
- No Oxylabs credentials or admin secret appear in the client bundle or any response body.
- `npm run typecheck`, `npm run lint`, and `npm run build` all pass.

## Checks to run

- `npm run typecheck`
- `npm run lint`
- `npm run build` (new API routes + server modules affect the build)

## Manual test steps

Prereqs: rename the existing `.env.local` keys `OXYLABS_WSA_USERNAME`/`OXYLABS_WSA_PASSWORD` to `OXY_WSA_USERNAME`/`OXY_WSA_PASSWORD`, and add `INSIGHT_AI_ADMIN_SECRET`; Supabase vars are already set. `supabase/schema.sql` + `supabase/seed.sql` already applied (5 active sources). Run `npm run dev` and **watch the dev-server terminal** — scrape progress logs there (§17).

1. **Inspect sources (§8):**
   ```bash
   curl http://localhost:3000/api/sources
   ```
   Expect the 5 active sources (id, name, listing_url).

2. **Missing secret → 401:**
   ```bash
   curl -i -X POST http://localhost:3000/api/scrape \
     -H 'Content-Type: application/json' -d '{}'
   ```
   Expect `401`, no scraping in the terminal.

3. **Scrape a subset (3 sources, 5 per source):**
   ```bash
   curl -X POST http://localhost:3000/api/scrape \
     -H 'Content-Type: application/json' \
     -H 'x-insight-ai-admin-secret: <your-INSIGHT_AI_ADMIN_SECRET>' \
     -d '{"sources":["Reuters","NPR","BBC"],"limitPerSource":5}'
   ```
   Watch the terminal for per-source start, homepage fetched, candidates found/rejected, duplicates skipped, detail pages scraped, inserted/rejected counts, and the final summary object. Response body is that summary.

4. **Default scrape (all active, 5 each):**
   ```bash
   curl -X POST http://localhost:3000/api/scrape \
     -H 'x-insight-ai-admin-secret: <your-INSIGHT_AI_ADMIN_SECRET>' \
     -H 'Content-Type: application/json' -d '{}'
   ```

5. **Verify in Supabase** (Table Editor / SQL Editor): new `articles` rows exist with non-null `image_url`, `published_at`, clean `raw_text`, `analyzed_at` null; no homepage/listing URLs saved. Check `logs` for the `scrape.summary` row.

6. **Idempotency / append-only:** re-run step 3 → the same articles are reported as duplicates skipped, `articlesInserted` is ~0 for already-seen URLs, and existing rows are unchanged (§10).

7. Articles will **not** appear on the home page yet — that needs AI analysis (`analyzed_at` set) in §19. Confirm via DB, not `/`.

8. Re-run `npm run typecheck && npm run lint && npm run build` → all pass.