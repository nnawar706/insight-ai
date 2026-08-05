# 002 — Homepage UI (static placeholder data)

## Goal

Build the INSIGHT AI home page UI — header, hero heading, and a responsive grid of news
cards — pixel-matched to `prompts/prompt-imgs/02-homepage.png`, rebranded from "biasly
News" to "INSIGHT AI" and adapted to this project's actual data model (single-source
articles with AI sentiment/framing analysis, not multi-source story clustering).

This pass uses realistic hardcoded sample articles so the layout is visually verifiable
today. It intentionally does **not** wire Supabase yet (no project/env vars/schema exist
yet) — that lands in a follow-up prompt once Supabase is connected, per AGENTS.md's
"UI must display stored data only" rule. The card and page components are structured so
swapping the static array for a real query later is a mechanical change (same shape as the
`article_analyses` fields in AGENTS.md section 19).

## Skills read

None of the four approved skills (`clerk`, `supabase`, `oxylabs-web-scraper`, `ai-sdk`)
apply — this is pure UI composition against local data, no auth, no DB, no scraping, no AI
calls.

## Existing code inspected

- `app/globals.css` — design tokens already established (colors, `--text-h1..caption`,
  `--radius-*`, `--shadow-*`, `--spacing: 4px`, `--container-insight: 1280px`). Built in
  `prompts/001-design-system-theme.md`.
- `app/layout.tsx` — Poppins font wired via `--font-poppins`, metadata already reads
  "INSIGHT AI" / "Balanced news coverage, powered by AI.", `<body>` is
  `min-h-full flex flex-col`.
- `app/page.tsx` — placeholder empty component (`div` with nothing inside), to be replaced.
- `prompts/prompt-imgs/02-homepage.png` — reference layout: dark top utility bar (browser
  chrome, not real product UI — excluded), header with logo + nav tabs + Subscribe/Login,
  topic pills row, "Top News" heading, 3-column card grid (image with info icon top-right,
  category · location line, headline, L/Center/Right bias bar, sources count), dark footer
  with logo/tagline + link columns + copyright.
- No `lib/`, no `components/` directory exists yet. No `@supabase/supabase-js`, no Clerk
  package installed. Confirmed via `package.json`.

## Decisions / assumptions (confirmed with user)

- **Data source:** static, realistic sample articles defined locally (not fetched from
  Supabase). Real wiring is a separate follow-up prompt once a Supabase project exists.
- **Header:** logo ("INSIGHT AI") + a single "Home" nav item + a "Login" button only. Drop
  the reference image's For You/Local/Blindspot tabs, topic pills row, theme toggle,
  date/location/edition selector, and Subscribe button — none map to in-scope features.
  Login is a static, non-functional link/button for now (Clerk isn't installed; wiring it
  is a separate prompt per AGENTS.md workflow).
- **Card footer:** replace the reference's "N sources" line with **source name + published
  date**, matching the required card fields in AGENTS.md section 19 (title, source, image,
  published date, sentiment label, AI-estimated framing label, L/C/R percentages,
  confidence when available).
- **Card top-right info icon:** kept as a static decorative affordance (tooltip-less circled
  "i") hinting at analysis detail, matching the reference image; it is not wired to any
  interaction in this pass (cards themselves link to the details page).
- Cards link to `/articles/[id]` (details page is a separate future prompt); route can
  404 for now — this prompt only needs the `<a>`/`<Link>` wiring to exist.
- Category/location eyebrow line (e.g. "Politics · United States") is derived from static
  sample fields (`category`, `location`) — these are presentational-only fields on the
  sample data, not implying new Supabase columns (the real `articles`/`sources` schema in
  AGENTS.md section 7 has no category/location fields; when Supabase wiring lands later,
  this line will likely map to `sources.name` and be revisited).
- No shadcn/ui — hand-rolled Tailwind components per project convention (matches
  `001-design-system-theme.md` decision).
- No dark/theme toggle — design system is single light theme only (section confirmed in
  001).

## Files likely to change

- `app/page.tsx` — replace placeholder with the full home page composition.
- `components/site-header.tsx` — new: logo, Home nav, Login button.
- `components/site-footer.tsx` — new: logo/tagline, link columns, copyright.
- `components/news-card.tsx` — new: article card (image, info icon, eyebrow, headline, bias
  bar, source + date).
- `components/bias-bar.tsx` — new: L/Center/Right segmented percentage bar using
  `--color-bias-left/center/right` tokens.
- `lib/sample-articles.ts` — new: typed static sample data (12 articles) shaped to match
  the future `article_analyses` fields (sentiment, framing, percentages, confidence) so the
  follow-up Supabase prompt can swap the source with minimal component changes.
- No new dependencies, no Supabase/Clerk packages, no schema files.

## Implementation requirements

1. **Sample data type** (`lib/sample-articles.ts`): export a `SampleArticle` type and a
   `sampleArticles: SampleArticle[]` array of 12 entries with fields: `id`, `title`,
   `imageUrl` (use real hotlink-safe placeholder images, e.g. `picsum.photos` or
   `images.unsplash.com` — must be publicly loadable, no local binary assets),
   `category`, `location`, `source`, `publishedAt` (ISO string), `sentimentLabel`
   (`"positive" | "neutral" | "negative"`), `biasLabel`
   (`"left" | "center" | "right" | "mixed" | "unclear"`), `leftPercentage`,
   `centerPercentage`, `rightPercentage` (numbers summing to 100), `confidence` (0–1).
   Vary categories/locations/percentages across entries to mirror the reference image's
   mix (politics, health, science, world, business, technology, climate, economy, sports,
   environment).
2. **`app/page.tsx`**: server component. Renders `SiteHeader`, a `max-w-[1280px] mx-auto`
   container with `px-6` (24px outer margin per grid spec), an `H2`-styled "Top News"
   heading, a responsive grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6`) of
   `NewsCard`s from `sampleArticles`, and `SiteFooter`.
3. **`components/site-header.tsx`**: sticky/static top bar, `bg-bg-primary` with
   `border-b border-border`. Left: "INSIGHT AI" wordmark (`text-h3` weight per token,
   Poppins bold). Center-left: single "Home" nav link (active/underlined state). Right:
   "Login" — styled as an outlined button matching the reference's Login button (border,
   rounded `radius-md`, `text-body-md`). No Subscribe button (auth-gated actions are out of
   scope until Clerk lands).
4. **`components/news-card.tsx`**: rounded (`radius-lg`) `bg-bg-primary` card with
   `border border-border` and `shadow-sm` (hover: `shadow-md` transition). Image area:
   16:9-ish `aspect-[16/10]` `next/image` with `rounded-t-lg`, small circled "i" icon
   absolutely positioned top-right on the image (semi-opaque dark circle, white icon).
   Below image, `p-4` content: eyebrow line `text-body-sm text-text-secondary` as
   `"{category} · {location}"`; headline `text-h4 font-medium text-text-primary
   line-clamp-3`; `BiasBar` component; footer row `text-caption text-text-secondary`
   showing `"{source} · {formattedDate}"`. Whole card wrapped in a `Link` to
   `/articles/{id}`.
5. **`components/bias-bar.tsx`**: props `leftPercentage`, `centerPercentage`,
   `rightPercentage`. Renders a `flex h-2 rounded-full overflow-hidden` row of three
   segments using `bg-bias-left` / `bg-bias-center` / `bg-bias-right` with `width: {n}%`
   inline styles (percentages are dynamic, not Tailwind-expressible statically), plus a
   row below showing `"L {n}%"`, `"Center {n}%"`, `"Right {n}%"` labels in `text-caption`,
   color-matched text (left = bias-left color, right = bias-right color, center = neutral
   text-secondary) — matching the reference image's labeled segmented bar.
6. **`components/site-footer.tsx`**: `bg-text-primary` (near-black) dark footer,
   `text-bg-primary`/white text. Left: "INSIGHT AI" wordmark + tagline "Balanced news
   coverage, powered by AI." Three link columns (Company: About/Careers/Press/Contact;
   Help: Help Center/Guides/Privacy Policy/Terms of Service; Connect: static
   X/LinkedIn/Instagram/YouTube icon links using inline SVGs, `href="#"`). Bottom row:
   `"© {currentYear} INSIGHT AI. All rights reserved."` — compute year with `new
   Date().getFullYear()`, not hardcoded.
7. Format `publishedAt` with a small local helper (e.g. `Intl.DateTimeFormat` — no new date
   library dependency).
8. Use `next/image` with explicit `width`/`height` or `fill` + `sizes`; add the sample
   image host(s) to `images.remotePatterns` in `next.config.ts`.
9. All new components are server components (no `"use client"`) — nothing here needs
   interactivity/state.

## Security requirements

None — static local data, no secrets, no external form submission, no user input, no
auth/session handling in this pass. `Link`/`href="#"` placeholders only.

## Acceptance criteria

- `app/page.tsx` renders header, "Top News" heading, a 3-column (responsive) grid of 12
  cards, and footer — no leftover placeholder `<div>`.
- No "biasly" text anywhere; every brand mention reads "INSIGHT AI".
- No topic pills, For You/Local/Blindspot tabs, theme toggle, location/edition selector, or
  Subscribe button present.
- Each card shows: image, decorative info icon, category · location eyebrow, headline,
  labeled L/Center/Right bias bar using the bias color tokens, and a source + published
  date footer line (no raw "N sources" count).
- Colors, type scale, radii, and shadows are pulled from the existing `globals.css` tokens
  — no new hardcoded hex values duplicating existing tokens.
- Layout is responsive: 1 column on mobile, 2 on tablet, 3 on desktop (`lg:`), matching the
  reference's desktop 3-column grid.
- `npm run lint` and `npm run build` succeed.

## Checks to run

- `npm run lint`
- `npm run build`

## Manual test steps

1. `npm run dev`
2. Open `http://localhost:3000` in a browser.
3. Confirm the header shows "INSIGHT AI", a "Home" link, and a "Login" button — no other
   nav items.
4. Confirm "Top News" heading and a grid of 12 article cards render with images, headlines,
   colored L/Center/Right bias bars with percentage labels, and a source/date line.
5. Resize the browser (or use devtools responsive mode) to confirm the grid collapses to 2
   columns then 1 column at narrower widths.
6. Click a card and confirm it navigates to `/articles/{id}` (a 404 is expected — the
   details page isn't built yet).
7. Confirm the footer shows the INSIGHT AI wordmark, tagline, three link columns, and a
   copyright line with the current year.
