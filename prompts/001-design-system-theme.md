# 001 — Design System Theme (tokens + Poppins + INSIGHT AI branding)

## Goal

Establish the **design-system theme only** — design tokens (colors, typography scale,
spacing, border radius, shadows, grid) and the Poppins font — derived pixel-accurately
from `prompts/prompt-imgs/01-ui-design-system.png`, with the brand name **"INSIGHT AI"** .

No UI components. No `/design-system` showcase page. No home page build-out. Theme
foundation only — later prompts (home page, details page) will consume these tokens.

## Skills read

None of the four approved skills (`clerk`, `supabase`, `oxylabs-web-scraper`, `ai-sdk`)
apply to a pure styling/token task. Per AGENTS.md section 3, Next.js conventions come from
`node_modules/next/dist/docs/` and Tailwind v4 conventions from the installed package
(`tailwindcss@^4`, `@tailwindcss/postcss@^4`) — confirmed via `package.json`.

## Existing code inspected

- `app/globals.css` — starter Tailwind v4 file (`@import "tailwindcss"`), Geist tokens,
  a `prefers-color-scheme: dark` block, default `--background`/`--foreground`.
- `app/layout.tsx` — loads `Geist`/`Geist_Mono` via `next/font/google`, applies them as CSS
  vars on `<html>`, `metadata` still says `"Create Next App"`.
- `app/page.tsx` — placeholder empty component, out of scope for this prompt (home page UI
  is a separate later prompt per AGENTS.md's `prompts/news-details-page-ui.md`-style
  naming).
- `package.json` — no `typecheck` script; checks available are `lint` and `build`.

## Decisions / assumptions

- **Brand name:** every visible/metadata instance of "biasly" / "biasly News" from the
  reference image becomes **"INSIGHT AI"**. The tagline "Balanced news coverage, powered by
  AI." is unchanged (not brand-name text).
- Tailwind v4 is CSS-first (`@import "tailwindcss"` + `@theme inline`) — tokens are added
  through `@theme inline` in `app/globals.css`, matching the existing starter pattern.
- Default Geist/Geist Mono fonts are replaced by Poppins as the app's sole sans font;
  Geist Mono is removed (design system specifies no mono font).
- The `prefers-color-scheme: dark` block is removed — the design system defines a single
  light theme only.
- Token naming follows Tailwind v4 conventions so utilities are generated (`--color-*`,
  `--radius-*`, `--shadow-*`, `--text-*`). Semantic names map directly to the sheet labels.
- Components (buttons, chips, bias meter, cards) are **not** built in this prompt — they
  are hand-rolled with Tailwind in later UI prompts, not shadcn (per project convention).

## Files likely to change

- `app/globals.css` — replace starter tokens with the full token set below.
- `app/layout.tsx` — swap Geist fonts for Poppins via `next/font/google`; wire
  `--font-poppins`; update `metadata` title/description to INSIGHT AI branding.

No new files. No new dependencies.

## Token spec (source of truth = reference image)

### Colors

| Token | Hex | Tailwind var |
| --- | --- | --- |
| Text Primary | `#0D0D0F` | `--color-text-primary` |
| Text Secondary | `#6B7280` | `--color-text-secondary` |
| Surface | `#F6F6F6` | `--color-surface` |
| Left Bias | `#B42318` | `--color-bias-left` |
| Center | `#E5E7EB` | `--color-bias-center` |
| Right Bias | `#1D4ED8` | `--color-bias-right` |
| BG Primary | `#FFFFFF` | `--color-bg-primary` |
| BG Secondary | `#F0F0F0` | `--color-bg-secondary` |
| Border | `#E5E7EB` | `--color-border` |
| Divider | `#E5E7EB` | `--color-divider` |

Also set base `--background: #FFFFFF` / `--foreground: #0D0D0F` so `body` reads correctly.

### Typography — Poppins

| Style | Size | Weight | Line height | Tailwind var |
| --- | --- | --- | --- | --- |
| H1 | 32px | 700 Bold | 1.2 | `--text-h1` |
| H2 | 24px | 600 SemiBold | 1.3 | `--text-h2` |
| H3 | 20px | 600 SemiBold | 1.3 | `--text-h3` |
| H4 | 16px | 500 Medium | 1.4 | `--text-h4` |
| Body Large | 16px | 400 Regular | 1.6 | `--text-body-lg` |
| Body Medium | 14px | 400 Regular | 1.6 | `--text-body-md` |
| Body Small | 13px | 400 Regular | 1.6 | `--text-body-sm` |
| Caption | 11px | 400 Regular | 1.4 | `--text-caption` |

Use Tailwind v4 `--text-*` tokens with paired `--text-*--line-height` so `text-h1` etc.
emit size + line-height. Load Poppins weights 400/500/600/700.

### Spacing — 4px base

Scale values on the sheet: `4, 8, 16, 24, 32, 40, 64` (px). Set `--spacing: 4px`
(Tailwind v4 base unit → `p-1`=4px, `p-2`=8px, `p-4`=16px, `p-6`=24px, `p-8`=32px,
`p-10`=40px, `p-16`=64px). No extra custom spacing tokens needed — all listed values fall
on the 4px scale.

### Grid

- Container max width: `1280px` → `--container-insight: 1280px`.
- 12 columns, gutter `24px`, outer margin `24px` — captured as a CSS comment next to the
  container token; no utility generation required for tokens-only scope.

### Border radius

| Token | Value | Tailwind var |
| --- | --- | --- |
| Small | 4px | `--radius-sm` |
| Medium | 8px | `--radius-md` |
| Large | 12px | `--radius-lg` |
| Full | 9999px | `--radius-full` |

### Shadows

| Token | Value | Tailwind var |
| --- | --- | --- |
| Small | `0px 1px 2px rgba(0,0,0,0.05)` | `--shadow-sm` |
| Medium | `0px 4px 12px rgba(0,0,0,0.08)` | `--shadow-md` |
| Large | `0px 12px 24px rgba(0,0,0,0.12)` | `--shadow-lg` |

## Implementation requirements

1. In `app/layout.tsx`, import `Poppins` from `next/font/google` with subset `latin`,
   weights `["400","500","600","700"]`, assigned to CSS variable `--font-poppins`. Remove
   `Geist`/`Geist_Mono`. Apply the variable on `<html>`. Update `metadata` to
   `{ title: "INSIGHT AI", description: "Balanced news coverage, powered by AI." }`.
2. In `app/globals.css`, keep `@import "tailwindcss";`. Replace the `@theme inline` block
   with the full token set above, mapping `--font-sans: var(--font-poppins)`. Remove the
   dark-mode media query. Keep `body` using `--background`/`--foreground` and `font-sans`.
3. Use exact hex/px/line-height values from the image — no approximation.
4. Group tokens with comments matching the sheet sections (Colors / Typography / Spacing /
   Radius / Shadows / Grid).
5. No occurrence of "biasly" remains anywhere in changed files; brand references use
   "INSIGHT AI".

## Security requirements

None — purely styling tokens and metadata. No secrets, no server/client boundary, no data
access introduced.

## Acceptance criteria

- `app/globals.css` defines every color, typography, radius, and shadow token from the
  image with exact values.
- Poppins loads via `next/font` and is the default sans font; no Geist/mono remains.
- Dark-mode block removed; single light theme.
- Page `<title>` reads "INSIGHT AI"; no "biasly" text remains in the diff.
- `npm run lint` and `npm run build` succeed.
- Diff limited to `app/globals.css` and `app/layout.tsx` — no components or pages added.

## Checks to run

- `npm run lint`
- `npm run build`

(No `typecheck` script in `package.json`; `build` covers type errors.)

## Manual test steps

1. `npm run dev`
2. Open the app in a browser — confirm the browser tab title reads "INSIGHT AI".
3. Inspect `<body>` via devtools — confirm computed `font-family` resolves to Poppins.
4. Confirm no console warnings about missing font variables.
