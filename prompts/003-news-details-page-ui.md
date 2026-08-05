# 003 — News Details Page UI (static placeholder data)

## Goal

Build the INSIGHT AI news details page at `/articles/[id]` — headline, hero image, bias
breakdown, article body, AI summary, framing notes, and related stories — pixel-adapted
from `prompts/prompt-imgs/03-news-details-page.png`, rebranded from "biasly News" to
"INSIGHT AI" and adapted to this project's actual single-article data model (no multi-outlet
story clustering).

This pass extends the existing static sample data (`lib/sample-articles.ts`) with the extra
fields a details page needs (summary, body paragraphs, framing notes, loaded terms,
disclaimer). It does **not** wire Supabase — same static-data approach as
`002-homepage-ui.md`, since no Supabase project/env vars/schema exist yet. Related Articles
here are a static slice of `sampleArticles`, not real pgvector similarity — that's section 20
of AGENTS.md, a future prompt once AI analysis and pgvector exist.

## Skills read

None of the four approved skills (`clerk`, `supabase`, `oxylabs-web-scraper`, `ai-sdk`)
apply — pure UI composition against local static data, no auth, no DB, no scraping, no AI
calls.

## Existing code inspected

- `prompts/prompt-imgs/03-news-details-page.png` — reference layout (see breakdown below).
- `lib/sample-articles.ts` — existing `SampleArticle` type/data (12 entries) from the
  homepage build: `id`, `title`, `imageUrl`, `category`, `location`, `source`,
  `publishedAt`, `sentimentLabel`, `biasLabel`, `leftPercentage`, `centerPercentage`,
  `rightPercentage`, `confidence`. No body text, summary, framing notes, loaded terms, or
  disclaimer yet.
- `components/news-card.tsx`, `components/bias-bar.tsx`, `components/site-header.tsx`,
  `components/site-footer.tsx` — established patterns: server components, tokens from
  `globals.css` only, `Intl.DateTimeFormat` for dates, decorative non-functional affordances
  (the card's "i" icon, header's "Login" button) rendered inert with no client boundary.
- `app/page.tsx` — `NewsCard` already links to `/articles/{id}`; that route currently 404s
  (expected per `002-homepage-ui.md` manual test step 6). This prompt creates that route.
- `app/globals.css` — full token set (colors, `--text-*`, spacing, radii, shadows) confirmed
  reusable as-is; no new tokens needed.
- `next.config.ts` — `images.remotePatterns` already allows `images.unsplash.com`, which
  every sample `imageUrl` uses; no config change needed since the hero image reuses
  `article.imageUrl` (the real `articles` schema in AGENTS.md section 7 has one
  `image_url` field, not separate thumbnail/hero fields).
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md`
  — confirmed dynamic route convention for this Next.js version: `params` is a `Promise`,
  must `await params` in an async Server Component page (`app/articles/[id]/page.tsx`).

## Reference image breakdown → mapping decisions

- **Top browser-chrome bar**: excluded (not real product UI — same call as
  `002-homepage-ui.md`).
- **Header/footer**: reuse the existing `SiteHeader`/`SiteFooter` components unchanged, no
  changes for this prompt. Accepted minor cosmetic gap: `SiteHeader`'s "Home" link is
  hard-coded active/underlined with no route-awareness, so it stays underlined on the
  details page too — not worth a client-side `usePathname` refactor for one underline.
- **Byline** ("By David Morgan · May 31, 2026 · 12 min read"): our schema has no author or
  read-time field (AGENTS.md §7 lists source reference, URL, title, image, published date,
  raw text — no author/read-time). Replaced with `{source} · {formattedDate}`, matching the
  `NewsCard` footer convention already established.
- **Sentiment**: not shown anywhere in the reference (it's a bias-only design), but AGENTS.md
  §19 requires the details page to show sentiment. Added as a small neutral bordered pill
  next to the byline showing the `sentimentLabel` — no new colors invented (kept to existing
  border/text-secondary tokens, since the design system has no green/red sentiment tokens and
  the bias-left/right red/blue tokens are reserved for political bias, not sentiment).
- **Save/Share icons**: kept as decorative, non-functional icon buttons (inert `<button>`,
  no handler, no client boundary) next to the byline — same treatment as the header's
  "Login" button and the card's "i" icon. Dropped the "..." overflow menu (no destination,
  redundant, avoid overbuild).
- **Hero image caption/credit** ("Photo: Andrew Harnik/Getty Images"): no such field in the
  schema — dropped, hero is just the image.
- **Inline "Bias Distribution" block** (under hero image): reuses the existing `BiasBar`
  component as-is (already a labeled L/Center/Right segmented bar — this is exactly its
  designed use case), inside a bordered card matching the reference's boxed block. Dropped
  the "12 sources" source count (no multi-outlet clustering in our model — see below).
- **Sidebar "Bias Analysis" card**: "Overall Bias" heading + big colored label line (see
  logic below) + reused `BiasBar` for the L/C/R breakdown + `confidence` line + an
  AI-estimation disclaimer sentence (required by AGENTS.md §19: "Political framing must be
  shown as AI-estimated, not objective truth") + a decorative inert "How We Analyze Bias"
  button. Simplification: the reference draws three separate per-row mini-bars here distinct
  from the block under the hero image; we reuse the one `BiasBar` component in both places
  instead of building a second bar visualization for the same numbers.
- **Overall Bias big stat logic**: reference shows `"{Label} {percentage}%"` (e.g.
  "Right 49%"). We compute this from real fields: if `biasLabel` is `left`/`center`/`right`,
  show that label capitalized plus its matching percentage; if `mixed` or `unclear`, show
  just the capitalized label with no invented percentage.
- **Sidebar "AI Summary" card**: reference shows bullet points; our schema stores one
  `summary` string (AGENTS.md §7/§19), not a bullet list, so it renders as a paragraph.
  Keeps the "AI summaries can make mistakes"-style line using the real `disclaimer` field,
  and a decorative inert "Provide Feedback" button (visual fidelity only, no backend).
  Dropped "Generated {date} · {read time}" (no such fields).
- **New "Framing Notes" card** (not in the reference image at all): AGENTS.md §19 explicitly
  requires the details page to show framing notes and loaded terms. Added as its own sidebar
  card below AI Summary: `framingNotes` paragraph + `loadedTerms` rendered as small pill
  chips (`bg-surface border-border text-caption`, no new colors).
- **Sidebar "Source Breakdown" card** ("12 Total Sources", per-source bias table): dropped
  entirely. This is a multi-outlet story-clustering feature ("biasly" aggregates many
  publishers per story). `002-homepage-ui.md` already established that this project analyzes
  single-source articles, not clustered stories (AGENTS.md §1/§7/§19 — one article, one
  `article_analyses` row, one `source`). There is nothing in our schema to power this card.
- **"Related Stories"** (6 cards, 2-column): kept, sourced from a static slice of the shared
  `sampleArticles` array (excluding the current article, first 6 by array order — no
  relevance scoring; that's pgvector's job in AGENTS.md §20, a future prompt). Rendered with
  a new compact `RelatedArticleCard` (image, eyebrow, headline, source + date) — no bias bar,
  matching the reference's simpler related-story cards and keeping `NewsCard` (which does
  show a bias bar) reserved for the homepage grid.
- **"Stay Informed. Stay Balanced." newsletter band**: dropped — not in AGENTS.md's in-scope
  feature list, no email backend exists, same reasoning `002-homepage-ui.md` used to drop the
  header's Subscribe button.

## Decisions / assumptions

- Static sample data only, same phase as `002-homepage-ui.md`; Supabase wiring is a separate
  future prompt.
- `app/articles/[id]/page.tsx` looks up the article by `id` in `sampleArticles`; unknown IDs
  call `notFound()` from `next/navigation`.
- `generateMetadata` sets the tab title to `"{article.title} | INSIGHT AI"` — cheap, standard
  Next.js practice, matches the branding already set in `app/layout.tsx`.
- All new components are server components (no `"use client"`) — nothing here needs
  interactivity/state, consistent with every existing component in `components/`.

## Files likely to change

- `lib/sample-articles.ts` — extend `SampleArticle` with `summary: string`,
  `bodyParagraphs: string[]`, `framingNotes: string`, `loadedTerms: string[]`,
  `disclaimer: string`; populate realistic content for all 12 existing entries (every
  homepage card links here, so every ID must resolve). Add a shared
  `AI_DISCLAIMER` constant for the repeated disclaimer sentence, referenced by each entry.
- `app/articles/[id]/page.tsx` — new dynamic route, async server component.
- `components/sentiment-badge.tsx` — new: small inert pill showing a `SentimentLabel`.
- `components/bias-analysis-card.tsx` — new: sidebar "Bias Analysis" card.
- `components/ai-summary-card.tsx` — new: sidebar "AI Summary" card.
- `components/framing-notes-card.tsx` — new: sidebar "Framing Notes" card (notes + loaded
  term chips).
- `components/related-article-card.tsx` — new: compact related-story card.
- No new dependencies, no Supabase/Clerk packages, no schema files, no changes to
  `SiteHeader`/`SiteFooter`/`NewsCard`/`BiasBar`/`next.config.ts`.

## Implementation requirements

1. **`lib/sample-articles.ts`**: add the five new fields to `SampleArticle` and fill them in
   for all 12 entries — `bodyParagraphs` as 4–6 realistic paragraphs per article,
   `summary` as one 2–4 sentence neutral paragraph, `framingNotes` as one short paragraph,
   `loadedTerms` as 2–4 short phrases pulled from that article's framing.
2. **`app/articles/[id]/page.tsx`**:
   - `params: Promise<{ id: string }>`; `await params`; look up
     `sampleArticles.find(a => a.id === id)`; call `notFound()` if missing.
   - `generateMetadata` returning `{ title: "{article.title} | INSIGHT AI" }`.
   - Render `SiteHeader`, a `max-w-(--container-insight) mx-auto px-6 py-8` container, a
     `grid grid-cols-1 lg:grid-cols-3 gap-8` layout (main content `lg:col-span-2`, sidebar
     `lg:col-span-1`), then `SiteFooter`.
   - **Main column**: eyebrow (`{category} · {location}`, `text-body-sm text-text-secondary`)
     → `H1` headline (`text-h1 font-bold text-text-primary`) → byline row (source · date,
     `SentimentBadge`, decorative Save/Share icon buttons) → hero image
     (`next/image`, `article.imageUrl`, rounded `radius-lg`, roughly 16:9) → bordered
     "Bias Distribution" block reusing `BiasBar` → article body (`bodyParagraphs.map` as
     `text-body-lg text-text-primary` paragraphs with spacing) → "Related Stories" heading
     (`text-h3`) → `grid grid-cols-1 sm:grid-cols-2 gap-6` of up to 6 `RelatedArticleCard`s.
   - **Sidebar column** (`flex flex-col gap-6`): `BiasAnalysisCard`, `AiSummaryCard`,
     `FramingNotesCard`, each a `rounded-lg border border-border bg-bg-primary p-6
     shadow-sm` card with an `text-h3` title.
3. **`components/sentiment-badge.tsx`**: props `sentimentLabel: SentimentLabel`; renders
   `<span>` with `rounded-full border border-border px-3 py-1 text-caption
   text-text-secondary` showing the capitalized label (e.g. "Neutral").
4. **`components/bias-analysis-card.tsx`**: props are the article's bias fields
   (`biasLabel`, `leftPercentage`, `centerPercentage`, `rightPercentage`, `confidence`).
   "Overall Bias" title, big stat line per the logic above (label colored via
   `text-bias-left`/`text-bias-right`/`text-text-primary` for left/right/other), reused
   `BiasBar`, a `Confidence: {n}%` line, the AI-estimation disclaimer sentence
   (`text-body-sm text-text-secondary`), and a decorative inert "How We Analyze Bias"
   `<button type="button">`.
5. **`components/ai-summary-card.tsx`**: props `summary`, `disclaimer`. "AI Summary" title,
   summary paragraph (`text-body-md text-text-primary`), disclaimer line
   (`text-caption text-text-secondary`), decorative inert "Provide Feedback"
   `<button type="button">`.
6. **`components/framing-notes-card.tsx`**: props `framingNotes`, `loadedTerms`. "Framing
   Notes" title, notes paragraph, "Loaded Terms" label, `loadedTerms.map` as
   `rounded-full bg-surface border border-border px-3 py-1 text-caption` chips in a
   `flex flex-wrap gap-2` row.
7. **`components/related-article-card.tsx`**: props `article: SampleArticle`. Smaller
   version of `NewsCard` without the bias bar — image (`aspect-[16/10]`), eyebrow, `text-h4`
   headline (`line-clamp-2`), `{source} · {date}` footer — wrapped in a `Link` to
   `/articles/{id}`.
8. Reuse the existing `dateFormatter`-style `Intl.DateTimeFormat` pattern (duplicate the
   small formatter in the new files, matching how `news-card.tsx` already does it — no new
   shared date-utils module for one formatter, consistent with current project size).

## Security requirements

None — static local data, no secrets, no external form submission, no user input, no
auth/session handling in this pass. Decorative buttons are inert with no handlers.

## Acceptance criteria

- Visiting `/articles/{id}` for any of the 12 sample IDs renders the full details page: eyebrow, headline, byline with source/date/sentiment badge, hero image, inline bias distribution block, article body, related stories grid, and a sidebar with Bias Analysis, AI Summary, and Framing Notes cards.
- Visiting `/articles/does-not-exist` renders the Next.js not-found page (404), not a crash.
- No "biasly" text anywhere; no "12 sources"/"Total Sources" multi-outlet UI; no newsletter
  signup band.
- Overall Bias stat and inline/sidebar bars are computed from the article's real
  `leftPercentage`/`centerPercentage`/`rightPercentage`/`biasLabel`/`confidence` fields, not
  hardcoded.
- Colors, type scale, radii, and shadows come from existing `globals.css` tokens only — no
  new hardcoded hex values.
- Layout is responsive: sidebar stacks below main content on mobile, side-by-side on
  `lg:` breakpoint; related stories grid is 1 column on mobile, 2 on `sm:`.
- `npm run lint` and `npm run build` succeed.

## Checks to run

- `npm run lint`
- `npm run build`

## Manual test steps

1. `npm run dev`
2. From `http://localhost:3000`, click any homepage news card and confirm it navigates to
   `/articles/{id}` and now renders a full details page instead of a 404.
3. Confirm the headline, byline (source · date), a sentiment pill, and the hero image render.
4. Confirm the boxed "Bias Distribution" block under the hero image shows a labeled
   L/Center/Right bar matching the card's original percentages.
5. Confirm the sidebar shows three cards: "Bias Analysis" (overall bias stat, bar,
   confidence), "AI Summary" (summary text + disclaimer), and "Framing Notes" (notes +
   loaded-term chips).
6. Confirm a "Related Stories" grid renders below the article body with up to 6 other
   articles, and clicking one navigates to that article's own details page.
7. Resize the browser to confirm the sidebar stacks below the main content on narrow
   widths and sits beside it on desktop widths.
8. Visit `http://localhost:3000/articles/does-not-exist` and confirm Next.js's not-found
   page renders instead of an error.
