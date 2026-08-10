# Wire Homepage + Article Details Page to Supabase (analyzed articles only)

## Goal

Replace the static `lib/sample-articles.ts` mock data on the homepage (`app/page.tsx`) and article details page (`app/articles/[id]/page.tsx`) with real reads from Supabase, showing **only articles that have been analyzed** (an `article_analyses` row exists — same definition used by the pending-analysis check, AGENTS.md §19).

**In scope:** `app/page.tsx`, `app/articles/[id]/page.tsx`, and the small prop-type/rendering adjustments to `components/news-card.tsx` and `components/related-article-card.tsx` needed to accept real data instead of `SampleArticle`.

**Out of scope:** Related Articles by similarity (§20 — no `embedding` column or `getRelatedArticles` query exist yet; explicitly deferred until pgvector is enabled). The existing "Save"/"Share"/"How We Analyze Bias"/"Provide Feedback" buttons stay decorative (no backend requested). No schema changes, no new API routes (Server Components read via the existing service-role query functions directly, the same pattern already used elsewhere in this codebase).

## Skills read

- `.agents/skills/supabase/SKILL.md` → service-role client is server-only and never reaches the browser as long as it's only called from Server Components/server modules (true for both target pages — neither has `"use client"`); no new query patterns needed since the exact queries already exist.

## Existing code inspected

- `lib/supabase/queries/articles.ts` → **`getPublishedArticles()`** already does exactly what "only analyzed" requires: inner-joins `article_analyses` (`analysis:article_analyses!inner(*)`) and filters `analyzed_at is not null`, ordered by `published_at desc`. Returns `Article & { source: Source; analysis: ArticleAnalysis }`. **`getArticleById(id)`** left-joins `article_analyses` (`analysis: ArticleAnalysis | null`) — an article can exist without analysis, so the page must treat `analysis === null` as not-found. Both are ready to use as-is; no new query functions needed for this task.
- `lib/sample-articles.ts` → `SampleArticle` has `category`/`location`/`bodyParagraphs` fields with no DB equivalent. `articles`/`sources` (§7) have no category or location columns, and never will per AGENTS.md's field list — this data was invented for the mockup. `bodyParagraphs` has a real equivalent: `articles.raw_text`, which the scraping pipeline already joins into `\n\n`-separated paragraphs before saving (§13 cleanup, confirmed in `lib/scraping/article.ts`).
- `components/news-card.tsx`, `components/related-article-card.tsx` → both `import type { SampleArticle } from "@/lib/sample-articles"` and render a `{article.category} · {article.location}` eyebrow line above the title, which has no data source once wired to Supabase.
- `components/sentiment-badge.tsx`, `components/bias-analysis-card.tsx` → import `SentimentLabel`/`BiasLabel` from `lib/sample-articles.ts`. Those unions (`"positive"|"neutral"|"negative"` / `"left"|"center"|"right"|"mixed"|"unclear"`) are byte-for-byte identical to `lib/supabase/types.ts`'s `SentimentLabel`/`BiasLabel`, so DB values already type-check against them structurally — but importing article-display types from the mock-data file once it's no longer used by any page is misleading, so this task repoints both imports to `lib/supabase/types.ts`.
- `app/page.tsx` / `app/articles/[id]/page.tsx` → current implementations read in full earlier this session; both are async Server Components already (no client-only APIs), so swapping `sampleArticles.find(...)` for an `await getX(...)` call is a direct, same-shape replacement everywhere except the fields noted above.
- `next.config.ts` → `images.remotePatterns` already allows any `https` hostname (`hostname: "*"`), so `next/image` will load scraped article images from any source domain without further config changes.
- `supabase/seed.sql` → 5 active sources exist; whether any articles are actually analyzed yet depends on whether `/api/scrape` + `/api/analyze` have been run — not assumed by this task, handled via an empty state.

## Decisions / assumptions

- **"Only analyzed" = has an `article_analyses` row**, matching §19's pending-analysis definition exactly (not just a non-null `analyzed_at`, though `getPublishedArticles` currently checks both — belt-and-suspenders, harmless). `getArticleById` results with `analysis === null` are treated as not-found (`notFound()`), consistent with "articles only appear... after analysis" — this naturally extends to direct detail-page visits by ID.
- **No category/location fabrication** (§5 "UI must display stored data only"): the `{category} · {location}` eyebrow line is removed from `NewsCard`, `RelatedArticleCard`, and the top of the article details page (where it duplicated the source name already shown lower down anyway) rather than inventing placeholder values.
- **`bodyParagraphs`** on the details page = `article.raw_text.split(/\n{2,}/)`, trimmed and empty-filtered — matches how the scraping pipeline already joins cleaned paragraphs.
- **New shared prop type** `NewsCardArticle` (id, title, imageUrl, source name, publishedAt, left/center/right percentage) defined once in `components/news-card.tsx` and imported into `components/related-article-card.tsx`, replacing both components' `SampleArticle` dependency. `SentimentBadge`/`BiasAnalysisCard` keep their existing prop shapes, just repointed to import `SentimentLabel`/`BiasLabel` from `lib/supabase/types.ts`.
- **Related Articles section stays empty for now**: `app/articles/[id]/page.tsx` passes `relatedArticles = []`; the existing `{relatedArticles.length > 0 && (...)}` guard already hides the section, so no visual change is needed to suppress it, and no `getRelatedArticles`/embedding work is added here (§20, separate task).
- **Empty state**: if `getPublishedArticles()` returns zero rows (nothing scraped/analyzed yet), the homepage renders a short "No analyzed articles yet." message instead of an empty grid, so the page doesn't look broken during initial setup.
- **`lib/sample-articles.ts` is left in place, just unused** — not deleted, since removing mock data wasn't requested and it's harmless dead code; flagging this so it doesn't look like an oversight.
- **Data fetching pattern**: both pages call the existing `lib/supabase/queries/articles.ts` functions directly from the (already async) Server Component, exactly like every other server-only module in this codebase — no new API route, since there's no mutation and the service-role client never reaches client code.

## Visual impact

- Homepage cards: image → title → bias bar → source/date (unchanged layout, just drops the now-empty eyebrow line above the title; slightly tightens the card).
- Article details page: hero image and layout unchanged; drops the top eyebrow line above the H1 (source + date still shown in the meta row right below the H1, so no information is lost — this was the intentional dedup call above). Bias bar, Bias Analysis card, AI Summary card, Framing Notes card all render from real values via the same components/markup, just fed real data instead of mock data. Related Stories section will not render until §20 ships (this is expected, not a bug).
- No Tailwind class or spacing/token changes — this task only changes what data feeds already-styled components, plus removing the one eyebrow line per component.

## Files likely to change

- `app/page.tsx` — fetch `getPublishedArticles()`, map rows → `NewsCardArticle[]`, render `NewsCard` per article, empty-state message when zero.
- `app/articles/[id]/page.tsx` — fetch `getArticleById(id)`, `notFound()` when missing or `analysis === null`, map to `BiasBar`/`SentimentBadge`/`BiasAnalysisCard`/`AiSummaryCard`/`FramingNotesCard` props, split `raw_text` into `bodyParagraphs`, `relatedArticles = []`, `generateMetadata` uses the real title.
- `components/news-card.tsx` — new `NewsCardArticle` type (exported), drop the category/location eyebrow line.
- `components/related-article-card.tsx` — import `NewsCardArticle` from `news-card.tsx` instead of `SampleArticle`, drop the eyebrow line.
- `components/sentiment-badge.tsx`, `components/bias-analysis-card.tsx` — repoint `SentimentLabel`/`BiasLabel` imports to `lib/supabase/types.ts`.

## Acceptance criteria

- Homepage renders real analyzed articles from Supabase, newest `published_at` first; articles without an `article_analyses` row never appear.
- Visiting `/articles/[id]` for an analyzed article shows real title, image, summary, sentiment, bias percentages/label, confidence, framing notes, loaded terms, and disclaimer from Supabase.
- Visiting `/articles/[id]` for an article that exists but isn't analyzed, or an id that doesn't exist, renders the Next.js not-found page.
- No references to `sampleArticles`/`SampleArticle` remain in `app/page.tsx`, `app/articles/[id]/page.tsx`, `components/news-card.tsx`, or `components/related-article-card.tsx`.
- `npm run typecheck` and `npm run lint` pass; `npm run build` succeeds.

## Checks to run

- `npm run typecheck`
- `npm run lint`
- `npm run build` (page/component changes affect the build output)

## Manual test steps (after implementation)

1. Ensure at least one article has been scraped and analyzed (`POST /api/scrape` then `POST /api/analyze`, per the earlier prompts' test steps) so there's real data to render.
2. `npm run dev`, open `http://localhost:3000/` — confirm real article cards render (or the empty-state message if nothing is analyzed yet).
3. Click a card, confirm `/articles/[id]` shows the real analysis (summary, bias bar, percentages, confidence, framing notes, loaded terms, disclaimer).
4. Visit a random/non-existent id, e.g. `http://localhost:3000/articles/00000000-0000-0000-0000-000000000000` — confirm the not-found page renders.
5. If any scraped-but-unanalyzed article exists, visit its id directly and confirm it also renders not-found (not a partial/broken page).
