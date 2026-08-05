# 004 — Clerk Authentication

## Goal

Add Clerk authentication to insight-ai: install `@clerk/nextjs`, wrap the app in `ClerkProvider`, add a `proxy.ts` (Next.js 16 naming — Clerk auth context available app-wide), create sign-in/sign-up pages, and wire the existing header "Login" control to real auth state (Login link when signed out, `UserButton` when signed in).

**Route protection (added after initial implementation):** the home page (`/`) stays fully public. The article details page (`/articles/[id]`) is gated behind auth — an unauthenticated user who clicks into an article is redirected to `/sign-in`. After signing in, Clerk returns them to the article they were trying to reach.

## Skills read

- `.agents/skills/clerk/SKILL.md` (router) → routed to `clerk-setup` and `clerk-nextjs-patterns`
- `.agents/skills/clerk-setup/SKILL.md`
- `.agents/skills/clerk-nextjs-patterns/SKILL.md`
- `.agents/skills/clerk-nextjs-patterns/references/middleware-strategies.md`
- `.agents/skills/clerk-nextjs-patterns/templates/nextjs-basic-auth/*` (reference template for `proxy.ts` and `layout.tsx`)
- `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` and `.../file-conventions/proxy.md` — confirmed Next.js 16 renamed `middleware.ts` → `proxy.ts` (same `clerkMiddleware()` export, same matcher semantics)
- Live Clerk Next.js quickstart (fetched) — confirmed: "Name the middleware file by the `next` version in `package.json`: `proxy.ts` on Next.js 16+"

## Existing code inspected

- `package.json` — Next.js 16.3.0, React 19.2.8, no Clerk package installed yet, no `components.json` (not shadcn, so no shadcn theme step)
- `.env.local` — already contains `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` (a Clerk app is already provisioned)
- No `.env.example` exists yet
- `app/layout.tsx` — root layout, `<body>` wraps `{children}` directly, uses Poppins font via `--font-poppins`
- `app/page.tsx`, `app/articles/[id]/page.tsx` — public pages, render stored/sample article data only
- `components/site-header.tsx` — server component; currently has a static `Login` link to `/login` styled as an outlined button
- `components/site-footer.tsx` — static footer, unrelated to auth
- `app/globals.css` — design tokens: `--color-text-primary: #0d0d0f`, `--color-border`, `--color-surface`, `--font-sans: var(--font-poppins)`, radii (`--radius-md: 8px`), spacing base 4px
- `prompts/001-003` — established the current visual design system (Poppins font, dark-ink text, minimal bordered buttons, 1280px container)

## Decisions / assumptions

1. **Reuse existing Clerk keys.** A Clerk app is already provisioned (keys in `.env.local`). Skip `clerk init`/`clerk link` CLI provisioning — just install the SDK and use the existing keys.
2. **File is `proxy.ts`, not `middleware.ts`** (Next.js 16.3.0 requires the new name; `middleware.ts` is deprecated).
3. **`/articles(.*)` is protected; everything else is public.** `proxy.ts` uses `createRouteMatcher(['/articles(.*)'])` and calls `auth.protect()` only for matched requests — this is the "public-first" strategy from `clerk-nextjs-patterns`. `auth.protect()`'s default unauthenticated behavior (redirect to the configured sign-in URL with a return-to param) is used as-is — no custom redirect logic needed, and Clerk returns the user to the article they clicked after sign-in.
4. **Routes: `/sign-in` and `/sign-up`** (Clerk convention, catch-all optional routes). The header's existing `Login` link (`href="/login"`) is repointed to `/sign-in` — no other design change to that link.
5. **Header auth state**: `SiteHeader` becomes an async server component using the `<Show when="signed-out">` / `<Show when="signed-in">` pattern from `@clerk/nextjs` — signed-out keeps the exact current `Login` link markup/styling (href changed to `/sign-in`), signed-in renders Clerk's `<UserButton />` in its place.
6. **Sign-in/up pages** reuse `SiteHeader` + `SiteFooter` for a consistent shell, with Clerk's `<SignIn />` / `<SignUp />` centered in the main content area. `appearance` is customized (via `ClerkProvider appearance.variables`) to match the site's font (Poppins) and ink color (`#0d0d0f`) instead of Clerk's default blue theme.
7. **No Supabase user sync / webhooks in this pass** — out of scope per `AGENTS.md` section 1 (not in the "build only" list).
8. **`.env.example` created** with just the Clerk-related variables from the `AGENTS.md` table (this is the first env-touching feature; other vars get added when those features are implemented).

## Files likely to change

- `package.json` / `package-lock.json` — add `@clerk/nextjs`
- `.env.local` — add sign-in/up URL + fallback redirect env vars (keys already present)
- `.env.example` — new file, Clerk vars only, no secret values
- `app/layout.tsx` — wrap `<body>` content in `<ClerkProvider>` with brand `appearance`
- `proxy.ts` — new file, project root; later edited to add `createRouteMatcher(['/articles(.*)'])` + `auth.protect()`
- `components/site-header.tsx` — signed-in/signed-out conditional auth UI
- `app/sign-in/[[...sign-in]]/page.tsx` — new
- `app/sign-up/[[...sign-up]]/page.tsx` — new

## Implementation requirements

- Install `@clerk/nextjs` (current/latest major, matching the "current SDK" row in the skill's version table).
- `proxy.ts` at project root:
  ```ts
  import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

  const isProtectedRoute = createRouteMatcher(['/articles(.*)'])

  export default clerkMiddleware(async (auth, req) => {
    if (isProtectedRoute(req)) await auth.protect()
  })

  export const config = {
    matcher: [
      '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
      '/(api|trpc)(.*)',
    ],
  }
  ```
- `app/layout.tsx`: import `ClerkProvider` from `@clerk/nextjs`, place it **inside** `<body>` (not wrapping `<html>`), pass `appearance.variables` (`colorPrimary: '#0d0d0f'`, `fontFamily: 'var(--font-poppins)'` or equivalent) so default Clerk UI matches the site.
- `components/site-header.tsx`: make it `async`, import `Show`, `UserButton` from `@clerk/nextjs`; keep the exact current `Login` `<Link>` styling for the signed-out state (only change `href` to `/sign-in`); render `<UserButton />` for the signed-in state in the same header slot.
- `app/sign-in/[[...sign-in]]/page.tsx` and `app/sign-up/[[...sign-up]]/page.tsx`: render `SiteHeader`, a centered `<SignIn />` / `<SignUp />` inside `main` (reuse the `max-w-(--container-insight)` / padding conventions from `app/page.tsx`), and `SiteFooter`.
- `.env.local` additions (values, not placeholders — same project):
  ```
  NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
  NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
  NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
  NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/
  ```
- `.env.example` (new): the same four keys above plus `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=` and `CLERK_SECRET_KEY=` as empty placeholders (no real values committed).
- Use `@clerk/nextjs/server` imports only in server-side code (`proxy.ts`); use `@clerk/nextjs` (client-safe exports like `ClerkProvider`, `Show`, `UserButton`, `SignIn`, `SignUp`) elsewhere.

## Security requirements

- `CLERK_SECRET_KEY` must never be imported into client components or sent to the browser.
- `.env.local` stays untracked (already covered by the repo's blanket `.env*` gitignore rule) — do not commit it.
- `.env.example` must contain no real secret values.
- No new API routes are added in this pass, so the admin-secret rule (`AGENTS.md` section 15) is not affected.

## Acceptance criteria

- `npm run dev` starts with no Clerk configuration errors.
- Visiting `/` shows the header with a `Login` link (signed out) pointing to `/sign-in`.
- `/sign-in` and `/sign-up` render Clerk's hosted forms inside the site's header/footer shell, styled to match the brand (no default Clerk blue).
- After signing in, the header shows `UserButton` instead of the `Login` link, and clicking it lets the user sign out.
- Home page (`/`) stays fully public and unchanged in content/behavior, signed in or not.
- Visiting `/articles/[id]` while signed out redirects to `/sign-in`; after signing in, the user lands back on the article they clicked.
- Visiting `/articles/[id]` while signed in renders the page normally.
- No `CLERK_SECRET_KEY` reference exists outside server-only files (`proxy.ts`).

## Checks to run

- `npm run typecheck`
- `npm run lint`
- `npm run build` (new root `proxy.ts` and root layout changes affect the build)

## Manual test steps

1. `npm run dev`
2. Open `http://localhost:3000` — confirm the header shows a `Login` link.
3. Click `Login` — confirm navigation to `http://localhost:3000/sign-in` and Clerk's sign-in form renders with the site's font/colors.
4. From the sign-in page, follow the "Sign up" link (or go directly to `/sign-up`) and create a test account.
5. After successful sign-up/sign-in, confirm redirect back to `/` and the header now shows the Clerk `UserButton` avatar instead of `Login`.
6. Click the `UserButton` → "Sign out" — confirm the header reverts to showing the `Login` link.
7. While signed out, click any article card on `/` — confirm you're redirected to `/sign-in` instead of the article.
8. Sign in from that redirect — confirm you land back on the article you clicked (not `/`).
9. While signed in, visit `/articles/[id]` directly — confirm it renders normally.
10. Confirm `/` itself remains fully accessible while signed out (no redirect on the home page).
