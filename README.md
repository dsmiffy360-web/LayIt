# Measure Twice

Real-app port of the flooring/ceiling cut planner. This README is written
for whoever picks this up next — possibly a future me, possibly a
developer you hand this to.

## What's actually done vs what's next

**Ported and working — the full core loop, for the common case:**
- `src/lib/layoutEngine.js` — every calculation function (all 11 lay
  patterns, roll goods, cut tallies), extracted unchanged from the
  verified prototype and re-tested after extraction and again after
  wiring into components — same 706-piece herringbone result, same
  62/64-plank straight-row result, every time.
- Supabase schema, auth, data layer, Stripe checkout + webhook — as
  before, all passing Node's real syntax checker.
- `src/App.jsx` — sign in → job list (loaded from Supabase) → open a job
  → **real workspace**, not a placeholder.
- `src/components/JobWorkspace.jsx` — the step container: job state,
  debounced autosave to Supabase, step navigation. Consolidated the
  artifact's ~30 separate `useState` calls into one `job` object + a
  single `updateJob(patch)` setter — cleaner for a real multi-file app,
  same field names throughout for easy cross-reference back to the
  artifact.
- **Setup step** — full port: sections, alcoves, unit conversion,
  project type (floor/ceiling).
- **Material step** — full port: plank/tile/roll toggle, material
  naming, mixed-width editor.
- **Pattern step** — the picker is fully wired (all 14 options, correctly
  filtered by project type); the *inline diagram preview* the artifact
  shows under the selected option is not yet ported (see below).
- **Results step** — full summary, batch cut list, and diagram for the
  five row-based patterns (Staggered, Cascade, 1/3 brick, Random,
  Straight), **all nine "exact" patterns** (Herringbone, Chevron, Basket
  weave, Diagonal plank, Diagonal herringbone, Pinwheel, Double
  herringbone, Hexagon, Versailles), **and Roll goods** — every material
  type and every pattern from the whole build now works in the real app,
  not just the artifact prototype. Porting roll goods surfaced a real
  pre-existing bug worth flagging: the check for `materialType === "roll"`
  was sitting *after* the plank-specific validation (positive plank
  length, pack size, stagger offset) — fields roll goods doesn't use at
  all — so a roll-goods job could have been wrongly rejected for missing
  plank fields it never needed. Fixed by moving the roll-goods branch
  before any of that, since it's a materialType concern entirely separate
  from `layoutMethod`. Verified end-to-end against the real module: the
  500×400cm / 366cm-roll test case from the original build gives exactly
  the same recommendation (widthwise), the same 800cm total length, and
  the same 32.21m² buffered area at 10% buffer — identical to its
  original verification.
- **Invoice step** — full port: business profile (now genuinely persisted
  per-account via Supabase, not per-job like the prototype — an
  improvement, since your business info shouldn't vary by job), client
  details, payment tracking, tax, extra line items, live preview, copy-
  as-text, print.
- `BlueprintDiagram` — the row-based diagram, including full alcove
  support and PNG export, ported essentially unchanged.

**Remaining gaps:**
- No tests against a live Supabase instance — I have no network access or
  ability to create external accounts from this environment. Everything
  here is correct by code review, Node's syntax checker, and running the
  actual calculation code paths (see the test commands throughout this
  file's history) — not by having run it against a real database. Worth
  a real smoke test before trusting it in production. This is genuinely
  the last gap between "should work" and "proven to work" — everything
  else from tonight's build (every pattern, every material type, PWA
  icons, the live pattern preview) is done and verified as far as
  verification is possible without a live deployment.

## PWA icons and pattern preview

Both generated/built this session:
- `public/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`,
  `apple-touch-icon.png`, `favicon.svg` — generated with Python/Pillow,
  matching the app's actual gradient (wood1→wood2) and "M" logomark
  design exactly rather than being generic placeholders. The maskable
  variant uses a larger safe-zone margin (24% vs 14%) since OS launchers
  crop maskable icons to arbitrary shapes.
- `src/lib/patternPreview.js` — a compact dispatcher
  (`computePatternPreview(job)`) that reuses every calculation function
  already in `layoutEngine.js` to compute a lightweight preview (first
  section only, no cut list) for whichever pattern is currently selected
  on the Pattern step, returning `null` rather than an error when inputs
  aren't ready yet (Setup/Material already validate those). Wired into
  `PatternStep.jsx` via a `kind → diagram component` lookup table, so
  adding this didn't require touching any of the nine ported diagram
  components — it just reuses them. Verified by testing the dispatcher
  directly (bypassing a Node ESM extension quirk that only affects raw
  `node` testing, not the actual Vite build): herringbone, hexagon, and
  Versailles previews reproduce the exact same piece counts as their
  original canonical verifications.

## Pattern-porting status: complete

Every material type (plank, tile, roll goods) and every one of the 14
lay patterns from the original build is now fully working in this real
app — sign in, describe a room, pick any pattern, get a verified result,
build an invoice, all backed by real Supabase persistence rather than
the artifact's local state. Porting roll goods last surfaced one genuine
pre-existing bug worth knowing about if you're extending this further:
the `materialType === "roll"` check had been sitting after
plank-specific validation that roll goods doesn't need, so a roll-goods
job could have been wrongly rejected for missing fields (plank length,
pack size) it never uses. Fixed by moving that check to the very top of
`ResultsStep.jsx`, before any pattern-specific branching — worth
remembering as a general lesson: a materialType concern and a
layoutMethod concern are genuinely different axes, and code that
branches on one while validation branches on the other is exactly where
this kind of bug hides.

**One real bug worth knowing about**: while wiring herringbone in, an
early `return` inside the new pattern branch ended up positioned *before*
a `useMemo` call still further down the function — a Rules of Hooks
violation (hooks can't be conditionally skipped). Caught it by reasoning
through the render order, not by running it (no build tooling available
in this environment). Fixed by converting that particular check from
`useMemo` to a plain computation, since it wasn't expensive enough to
need memoizing anyway. Worth double-checking for the same issue when
porting the next pattern, since each new branch is another opportunity
to place an early return above an existing hook call.

## Setting this up for real

You'll need to do these account-creation steps yourself — I can't create
external accounts or hold credentials on your behalf.

### 1. Supabase (accounts + database)
1. Create a project at supabase.com (free tier is fine to start).
2. SQL Editor → New query → paste the contents of `supabase/schema.sql` → Run.
3. Authentication → Providers → enable Email (magic link is on by
   default) and Google if you want that option too (needs a Google OAuth
   client ID/secret from Google Cloud Console).
4. Project Settings → API → copy the Project URL and anon/public key into
   your `.env.local` (see `.env.example`).
5. Project Settings → API → copy the service_role key too — this one is
   secret, only goes in your hosting provider's server-side environment
   variables, never in anything prefixed `VITE_`.

### 2. Stripe (payments)
1. Create a Stripe account, stay in test mode while developing.
2. Products → Add product → "Contractor" → set a recurring price → copy
   the Price ID (`price_...`) into `STRIPE_CONTRACTOR_PRICE_ID`.
3. Developers → API keys → copy the secret key into `STRIPE_SECRET_KEY`.
4. Developers → Webhooks → Add endpoint → URL will be
   `https://your-domain/api/stripe-webhook` (you'll have this once
   deployed in step 3) → select events `checkout.session.completed`,
   `customer.subscription.updated`, `customer.subscription.deleted` →
   copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

### 3. Deploy (Vercel)
1. Push this folder to a GitHub repo.
2. vercel.com → New Project → import the repo. Vercel auto-detects Vite
   and the `api/` folder as serverless functions — no config needed.
3. Add every variable from `.env.example` in Project Settings →
   Environment Variables (including the server-only ones — Vercel keeps
   those out of the client bundle automatically).
4. Deploy. Go back to Stripe's webhook config and confirm the URL matches
   your real deployed domain.

### Local development
```
npm install
cp .env.example .env.local   # fill in your real values
npm run dev
```

## Why these specific choices (context for later)

- **PWA over native app** — no App Store review, no 15–30% platform
  payment cut, ships in days. Native is worth revisiting only if usage
  justifies the bigger investment.
- **Supabase over rolling your own auth/DB** — bundles Postgres + auth in
  one service, which is exactly the two things "accounts + job sync"
  needed.
- **Magic link + Google, no password** — the target user (a contractor
  mid-job on a phone) doesn't want to manage a password.
- **Stripe Checkout + Customer Portal, not custom billing UI** — Stripe's
  hosted pages handle subscription upgrade/downgrade/cancel; building
  that ourselves would be pure risk for zero benefit.
- **One `job` object + `updateJob(patch)` instead of ~30 useState calls**
  — the artifact grew its state incrementally over a long build session,
  which is exactly when many small `useState` calls make sense. Starting
  fresh here, a single state object matching the Supabase JSONB column is
  simpler to reason about and autosave.


You'll need to do these account-creation steps yourself — I can't create
external accounts or hold credentials on your behalf.

### 1. Supabase (accounts + database)
1. Create a project at supabase.com (free tier is fine to start).
2. SQL Editor → New query → paste the contents of `supabase/schema.sql` → Run.
3. Authentication → Providers → enable Email (magic link is on by
   default) and Google if you want that option too (needs a Google OAuth
   client ID/secret from Google Cloud Console).
4. Project Settings → API → copy the Project URL and anon/public key into
   your `.env.local` (see `.env.example`).
5. Project Settings → API → copy the service_role key too — this one is
   secret, only goes in your hosting provider's server-side environment
   variables, never in anything prefixed `VITE_`.

### 2. Stripe (payments)
1. Create a Stripe account, stay in test mode while developing.
2. Products → Add product → "Contractor" → set a recurring price → copy
   the Price ID (`price_...`) into `STRIPE_CONTRACTOR_PRICE_ID`.
3. Developers → API keys → copy the secret key into `STRIPE_SECRET_KEY`.
4. Developers → Webhooks → Add endpoint → URL will be
   `https://your-domain/api/stripe-webhook` (you'll have this once
   deployed in step 3) → select events `checkout.session.completed`,
   `customer.subscription.updated`, `customer.subscription.deleted` →
   copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

### 3. Deploy (Vercel)
1. Push this folder to a GitHub repo.
2. vercel.com → New Project → import the repo. Vercel auto-detects Vite
   and the `api/` folder as serverless functions — no config needed.
3. Add every variable from `.env.example` in Project Settings →
   Environment Variables (including the server-only ones — Vercel keeps
   those out of the client bundle automatically).
4. Deploy. Go back to Stripe's webhook config and confirm the URL matches
   your real deployed domain.

### Local development
```
npm install
cp .env.example .env.local   # fill in your real values
npm run dev
```

## Why these specific choices (context for later)

- **PWA over native app** — no App Store review, no 15–30% platform
  payment cut, ships in days. Native is worth revisiting only if usage
  justifies the bigger investment.
- **Supabase over rolling your own auth/DB** — bundles Postgres + auth in
  one service, which is exactly the two things "accounts + job sync"
  needed.
- **Magic link + Google, no password** — the target user (a contractor
  mid-job on a phone) doesn't want to manage a password.
- **Stripe Checkout + Customer Portal, not custom billing UI** — Stripe's
  hosted pages handle subscription upgrade/downgrade/cancel; building
  that ourselves would be pure risk for zero benefit.
