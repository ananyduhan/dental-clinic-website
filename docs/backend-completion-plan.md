# Backend Completion Plan

> Working plan to take this project from "high-fidelity prototype" to "functioning
> application". Scope is the **server tier only** — the UI is ~90% built and is
> touched here only where it must be unwired from mock data.
>
> Written 2026-08-25. Grounded in `docs/api-conventions.md`, `docs/booking-flow.md`,
> `docs/security.md`, and `CLAUDE.md`. Where this plan and those docs disagree, the
> docs win — except where noted under "Contract decisions", which are open items
> that need a human call.

---

## Where the project actually stands

| Layer | State |
|---|---|
| Design system, UI components, pages | ~90% — complete and good |
| Prisma schema, seed script | ~95% — one bug, one missing column |
| `lib/` helpers (email, whatsapp, export, rate-limit, errors, auth config) | ~85% — written, but nothing calls them |
| Zod validators | ~90% — auth aligned to `security.md`; booking fields still drift |
| **API route handlers** | ✅ 100% — all replaced, 7 routes added including `/api/cron/reminders` |
| **Server actions** | ✅ 100% — `lib/actions/`, 15 actions behind a typed result wrapper |
| Middleware | ✅ done (Phase 1) |
| Migrations | ✅ applied to Supabase; partial index verified in-database |
| Tests | ✅ 134 unit + 36 integration + 3 Playwright e2e |
| Deploy/observability | ✅ hourly cron in `vercel.json`, Sentry initialised (no source maps yet) |

**Overall: the server tier is done.** All six phases are complete. A patient can
register, verify, book, view, and cancel; an admin manages everything and
exports; reminders go out hourly. What is left is the launch checklist at the
bottom of this document, not more building.

---

## Three findings that shape this plan

These came out of reading the specs against the code. They are not style nits —
each one changes what gets built.

### 1. The slot engine does not match its own spec

`lib/slots.ts` is clean, pure, and unit-tested — but it implements a different
algorithm than `docs/booking-flow.md` describes.

| `docs/booking-flow.md` requires | `lib/slots.ts` currently does |
|---|---|
| `startUtc` / `endUtc` as `Date` objects | `"HH:mm"` strings |
| Timezone conversion via `date-fns-tz` | No timezone handling at all |
| Steps by 15 min (`stepMinutes`, configurable) | Steps by `serviceDurationMinutes` |
| Inputs: `availability`, `blockedDates`, injected `now`, `timezone` | Bare start/end time strings |
| DST spring-forward / fall-back handling | None |

The doc explains why the 15-minute grid matters: stepping by duration means that
if a 30-min checkup sits at 09:00, a patient wanting a 60-min filling is offered
09:30–10:30 only — silently missing that 10:00–11:00 is also valid.

**Consequence:** Phase 3 is a rewrite, not a wiring job. The existing tests get
replaced too. Budget accordingly.

### 2. The unique constraint was a live bug (fixed in Phase 0)

`prisma/schema.prisma` had:

```prisma
@@unique([dentistId, appointmentDate, startTime])
```

Unconditional — it counts `CANCELLED` rows. **Once a patient cancelled a 09:00
slot, that slot could never be booked again by anyone.** `docs/booking-flow.md`
specifies a *partial* index scoped to active statuses. Prisma's DSL cannot
express `WHERE`, so it must be raw SQL in the migration.

Fixed in Phase 0. See "Known Prisma limitation" below for the ongoing care this
needs.

### 3. Contract mismatches to settle before writing 10 handlers against them

| Thing | `docs/` says | Code says | Action |
|---|---|---|---|
| Error response shape | `{ error: { code, message, details } }` | `types/index.ts` → `{ error: string, code, details }` | Adopt the doc shape |
| Error helper | `handleApiError(err)` → `NextResponse` | `lib/errors.ts` exports `toHttpError()` | Add `handleApiError`, keep `toHttpError` as its internal |
| Validator file | `lib/validators/booking.ts` | `lib/validators/appointment.ts` | Keep the existing filename; align the fields |
| Date field | `date` | `appointmentDate` | Pick one — see below |
| `dentistId` | `.uuid().nullable()` (null = no preference) | `.uuid()` — **required** | **Must become nullable** |

That last row is a functional bug, not a naming quibble: `booking-form.tsx:38`
already renders a "No preference" option, and the current schema makes it
impossible to submit.

---

## Phase 0 — Make it runnable ✅ DONE

Nothing could be verified before this; `node_modules` was absent, so `pnpm
typecheck` / `lint` / `test` could not run at all.

| # | Step | Result |
|---|---|---|
| 0.1 | `pnpm install` | ✅ done in 4.1s |
| 0.2 | `.env` created from `.env.example`; `AUTH_SECRET` + `CRON_SECRET` generated | ✅ done (`.env` is gitignored) |
| 0.3 | `CLINIC_TIMEZONE=Australia/Sydney` added to `.env` **and** `.env.example` | ✅ done — `booking-flow.md` requires it from env; it was missing |
| 0.4 | `pnpm prisma generate` | ✅ done — this was the hard blocker on typecheck |
| 0.5 | Removed the over-broad `@@unique`; added the partial index as raw SQL | ✅ done |
| 0.6 | Hand-authored `prisma/migrations/20260825000000_init/migration.sql` (176 lines, 8 tables) via `prisma migrate diff --from-empty`, offline | ✅ done |
| 0.7 | `pnpm prisma validate` | ✅ valid |
| 0.8 | Fixed `prisma/seed.ts:232` — its `upsert` keyed off the compound `@@unique` removed in 0.5. Replaced with `createMany` (the seed already truncates every table first, so there was nothing to upsert against) | ✅ done — caught by `pnpm build` |
| 0.9 | Baseline `typecheck` / `lint` / `test` / `build` | ✅ **all four green — 0 type errors, 0 lint errors, 9/9 tests, clean production build** |
| 0.10 | `prisma migrate deploy` + `pnpm db:seed` against Supabase | ✅ **done** — 8 tables created, partial index verified in-database, 14 users / 3 dentists / 5 services / 20 appointments seeded |

`pnpm build` is now part of the baseline even though `CLAUDE.md` only mandates
typecheck/lint/test. It earned its place immediately: it was the only check that
caught the stale `upsert` in the seed, because `tsc` had been run against a
Prisma client generated *before* the schema edit.

### Database setup, as actually performed

Supabase project in `ap-southeast-2` (Sydney). Two connection
strings are required and `prisma/schema.prisma` now declares both:

```prisma
url       = env("DATABASE_URL")   // pooled, port 6543 — app runtime
directUrl = env("DIRECT_URL")     // direct, port 5432 — migrations only
```

Migrations must bypass PgBouncer: its transaction pooler does not support the
advisory locks and prepared statements `prisma migrate` relies on. Runtime
queries must *use* the pooler, because serverless functions open far more
connections than a direct link survives.

Seeded logins: `admin@demo.com` / `Admin123!`, `patient1@demo.com` …
`patient10@demo.com` / `Patient123!`.

### Debugging note: P1001 does not always mean "unreachable"

The first connection attempt failed with:

```
P1001: Can't reach database server at `aws-0-ap-northeast-1.pooler.supabase.com:5432`
```

which is misleading. DNS resolved, TCP was open on both 6543 and 5432, and the
project's REST endpoint returned 401 (healthy — "missing apikey"). The actual
cause was that the password was still the dashboard's `[YOUR-PASSWORD]`
placeholder. The pooler is a shared load balancer that accepts the TCP connection
from anyone and only then fails the tenant handshake, which Prisma surfaces as
P1001 rather than an auth error.

**When you see P1001 against Supabase, check the credentials before the network.**
A quick triage that does not print secrets:

```bash
set -a; . ./.env; set +a
nc -z <host> 5432                      # TCP open?  -> not a network problem
curl -s -o /dev/null -w '%{http_code}' https://<project-ref>.supabase.co/rest/v1/
                                       # 401 = project live; 503 = paused
```

### Region: moved Tokyo -> Sydney

The project was originally created in `ap-northeast-1` (Tokyo) while the clinic
timezone is `Australia/Sydney`. Measured from a Sydney machine:

| Region | TCP connect |
|---|---|
| `ap-northeast-1` (Tokyo) | 222 ms |
| `ap-southeast-2` (Sydney) | **30 ms** |

7.4x, about 192 ms of pure round-trip on every database call.

Supabase cannot change a project's region in place — a project is tied to the
infrastructure it was provisioned on, and Project Transfers move projects between
*organizations*, not regions. The fix was to recreate in `ap-southeast-2`. The
official backup/restore migration guide did not apply: the database held only
seed data, so it was a recreate plus `migrate deploy` and `db:seed`.

**In production the latency that matters is Vercel function -> Supabase, not
browser -> Supabase**, and Vercel defaults to `iad1` (Washington DC). Deploying
with defaults against a Tokyo database would have meant US functions, Japanese
database, Australian patients. `vercel.json` now pins functions to `syd1` so they
are co-located with the database and close to patients. Phase 6 added the hourly cron
entry to that same file, once `/api/cron/reminders` existed to point it at.

The project ref lives only in `.env`; nothing in the repo hardcodes it, so the
move was a two-line change.

### Known Prisma limitation — read before running `migrate dev`

Prisma does not know about the partial index, because its DSL cannot represent
one. `prisma migrate dev` builds a shadow database from the migration history and
diffs it against `schema.prisma` — so it will see `appointments_active_slot_unique`
as drift and **try to generate a migration that drops it.**

Rules going forward:

- Use `prisma migrate deploy` to apply migrations.
- When you do run `migrate dev` to author a *new* migration, **always read the
  generated SQL** and delete any `DROP INDEX "appointments_active_slot_unique"`.
- The index definition is commented in-place in the init migration so the reason
  survives contact with whoever hits this next.

---

## Phase 1 — Shared foundation ✅ DONE

Everything downstream imports these. Built first so Phases 2–6 do not refactor twice.

| File | Action | Result |
|---|---|---|
| `lib/constants.ts` | **new** | ✅ `CLINIC_TIMEZONE` (env, validated against `Intl`), `SLOT_STEP_MINUTES`, `CANCELLATION_WINDOW_MS`, reminder window, page-size caps |
| `lib/auth.config.ts` | **new** | ✅ Edge-safe NextAuth config + path predicates — **see "The middleware problem" below** |
| `lib/auth.ts` | refactor | ✅ Spreads `authConfig`; keeps only the Credentials provider and `requireRole` |
| `middleware.ts` | **new** | ✅ Session gate with `callbackUrl` preservation and a patient→`/dashboard` bounce off `/admin` |
| `lib/errors.ts` | extend | ✅ `handleApiError()`, `SlotNoLongerAvailableError`, Zod → 422 with field details, Prisma P2002/P2003/P2025 mapping, `ValidationError.details` |
| `types/index.ts` | fix | ✅ `ApiError` → the nested `{ error: { code, message, details } }` shape |
| `lib/rate-limit.ts` | fix | ✅ Lazy Redis + limiters; `checkRateLimit` fails **open** and logs |
| `app/(public)/login/page.tsx` | fix | ✅ Reads `callbackUrl` (was reading `next`, which nothing sets) + open-redirect guard |
| `tests/unit/errors.test.ts` | **new** | ✅ 27 tests |
| `next.config.mjs` | fix | ✅ `serverComponentsExternalPackages: ["@sentry/nextjs"]` — the lazy Sentry import otherwise emits an OpenTelemetry "Critical dependency" warning on every build |

**Gate met:** `typecheck` ✅ · `lint` ✅ · `test` ✅ **36/36** (was 9) · `build` ✅

Verified live against `pnpm dev`: all six protected paths 307 to
`/login?callbackUrl=…` with query strings preserved; `/`, `/login`, `/register`
serve 200.

### The middleware problem, and why `lib/auth.config.ts` exists

`middleware.ts` could not simply import `lib/auth.ts`. Next 14 middleware runs on
the **edge runtime**, and `lib/auth.ts` imports Prisma Client and bcrypt, neither
of which runs there. This is the standard NextAuth v5 split:

- **`lib/auth.config.ts`** — pure. Session strategy, pages, `jwt`/`session`
  callbacks, path predicates. Only *type* imports from `@prisma/client`, which
  are erased at compile time. This is what middleware instantiates.
- **`lib/auth.ts`** — spreads `authConfig`, adds the Credentials provider (Prisma
  + bcrypt). Used from route handlers, server components, and server actions.

Verified by grepping the built edge bundle (`.next/server/middleware.js`, 236 KB):
**0 occurrences of `PrismaClient`, `prisma`, or `bcrypt`.**

Keep the callbacks in `auth.config.ts` only. Redeclaring them in `auth.ts` would
silently shadow the shared ones and drift the token shape between middleware and
the app.

### Middleware is a UX gate, not the authorization boundary

It reads the JWT and nothing else, so it cannot see a demotion: a user downgraded
from ADMIN to PATIENT keeps an ADMIN token until it expires. `CLAUDE.md` is
explicit — **every server action and route handler re-checks the role itself.**
Phase 5 does not get to lean on this.

### Two deviations from the original plan

1. **`checkRateLimit` fails open, not closed.** If Upstash is unconfigured or
   unreachable, requests are allowed and a warning is logged. An outage at the
   rate limiter should not lock every user out of login. This is a deliberate
   availability-over-strictness trade; `docs/security.md` treats rate limiting as
   defence in depth rather than the only lock on the door. Revisit if abuse
   becomes real.
2. **`authRateLimiter` / `bookingRateLimiter` are now `getAuthRateLimiter()` /
   `getBookingRateLimiter()`.** Const exports cannot be lazy. Nothing imported
   them yet, so there was no breakage — but Phase 2 should use the getters.

---

## Phase 2 — Auth completion ✅ DONE

**This was the highest-urgency gap: no user could create an account.** The
registration UI POSTed to an endpoint that did not exist, so the only users in
the system were the ones `prisma/seed.ts` inserts.

| File | Action | Result |
|---|---|---|
| `lib/tokens.ts` | **new** | ✅ 32-byte CSPRNG tokens, SHA-256 hashed for storage, TTL constants |
| `lib/accounts.ts` | **new** | ✅ `registerPatient`, `verifyEmail`, `requestPasswordReset`, `resetPassword` |
| `app/api/auth/register/route.ts` | **new** | ✅ bcrypt 12, 3/hour per IP |
| `app/api/auth/verify-email/route.ts` | **new** | ✅ redirects to `/verify-email?status=…` |
| `app/api/auth/forgot-password/route.ts` | **new** | ✅ always 200, 3/hour per email |
| `app/api/auth/reset-password/route.ts` | **new** | ✅ single-use, 5/hour per IP |
| `app/(public)/verify-email/page.tsx` | **new** | ✅ four states, no token handling |
| `lib/rate-limit.ts` | refactor | ✅ registry of all 7 limits from `security.md`; `enforceRateLimit`, `clientIpFrom` |
| `lib/errors.ts` | extend | ✅ `Retry-After` on 429 |
| `lib/email.ts`, `lib/whatsapp.ts` | fix | ✅ lazy clients — **see below** |
| `lib/validators/auth.ts` | fix | ✅ password min 8 → **10**, per `security.md:32` |
| 3 × public pages | fix | ✅ read `error.message`, not `error` as a string |
| `tests/unit/{tokens,accounts}.test.ts` | **new** | ✅ 31 tests |

**Gate met:** `typecheck` ✅ · `lint` ✅ · `test` ✅ **67/67** (was 36) · `build` ✅

Verified live against `pnpm dev`:

- 422 with the documented `{ error: { code, message, details } }` envelope and
  correct per-field messages, on all four endpoints.
- `/api/auth/verify-email` with no token → 307 to `/verify-email?status=invalid`.
- All four page states render 200 with the right heading.
- **DB unreachable → generic `INTERNAL_SERVER_ERROR` 500 with no trace of
  Prisma, Postgres, the host, the port, or table names**, while the server log
  retains the real cause (`Can't reach database server at localhost:5432`).

### Tokens are stored hashed

`docs/security.md:36,41` requires it, and the existing schema already supports it
with no migration: the raw token goes in the email, its SHA-256 hash goes in the
`token` column, and lookup is by hash. A leaked database backup therefore does
not yield working reset links.

SHA-256 rather than bcrypt is deliberate — these are 32 bytes of CSPRNG output,
so there is no dictionary to attack and a slow KDF buys nothing while making
every verification click slower. Lookup-by-hash is an indexed equality match
inside Postgres, so no secret is compared in application code and there is no
timing channel to close.

### Enumeration resistance

Registration resolves identically whether or not the address exists. A
distinguishable "email already registered" response would let anyone test which
addresses hold accounts at a dental clinic — medical-adjacent information. An
existing *unverified* address gets its verification email re-sent, since that is
almost always someone who lost the first one.

### The same import-time crash, twice more

`lib/email.ts` built `new Resend(process.env.RESEND_API_KEY)` at module scope,
which throws on a missing key. It was harmless only because nothing imported it.
The moment a route handler did, `next build` failed at page-data collection:

```
Error: Missing API key. Pass it to the constructor `new Resend("re_123")`
```

Identical in shape to the Upstash bug fixed in Phase 1. Both are now lazy, and
`lib/whatsapp.ts` was fixed pre-emptively — it has the same module-scope
`twilio()` call and would have failed the same way in Phase 6.

With no `RESEND_API_KEY`, non-production sends log the message (including the
verification link) to the console instead, so the flow is testable without a
Resend account. In production a missing key throws: silently dropping a password
reset is worse than a failed request.

### Deviations worth knowing

1. **Password minimum raised 8 → 10**, per `security.md:32`. UI copy updated in
   both places. Note the seed's `Admin123!` is 9 characters — it still works
   (seeds bcrypt directly, bypassing Zod) but that admin could not *reset* to the
   same password. Worth changing in `prisma/seed.ts` before launch.
2. **zxcvbn score ≥ 3 not implemented.** `security.md:34` asks for it, but
   `zxcvbn` is not a dependency and adding one is a call for you, not me. The
   length/letter/number rules are enforced. Flagging as an open item.
3. **Reset-token TTL corrected to 30 minutes.** `security.md:36` says 30 min;
   `lib/email.ts` copy said "1 hour". The doc wins; the copy was updated.
4. **A completed password reset also sets `emailVerified = true`.** Completing
   one proves mailbox control. Without this, a user who registered but never
   clicked verify would reset successfully and *still* be locked out, because
   `lib/auth.ts` refuses unverified logins.

### End-to-end gate: passed against Supabase

Walked the full flow with `curl` against a live database:

| # | Step | Result |
|---|---|---|
| 1 | `POST /api/auth/register` | 201 |
| 2 | Row written | `role=PATIENT`, `emailVerified=false`, bcrypt cost 12 ✅ |
| 3 | Stored token vs. emailed token | **stored ≠ raw**, **stored = sha256(raw)** ✅ |
| 4 | Login *before* verifying | refused ✅ |
| 5 | Click verify link | 307 → `?status=verified`; token row deleted |
| 6 | Click the same link again | 307 → `?status=invalid` ✅ single-use |
| 7 | Login after verifying | session carries `role`, `firstName`, `isEmailVerified` ✅ |
| 8 | `/dashboard`, `/book` | 200 |
| 9 | `/admin` as PATIENT | 307 → `/dashboard` ✅ |
| 10 | forgot-password, known vs unknown address | **byte-identical 200** ✅ |
| 11 | Reset, then replay the same token | 200, then 422 "already been used" ✅ |
| 12 | Login with old password | refused; new password works ✅ |
| 13 | Seeded `admin@demo.com` | `ADMIN`, `/admin` → 200 ✅ |

The e2e user was deleted afterwards; the database is back to seed state.

The `RESEND_API_KEY` is still unset — the verification link came from the
dev-console fallback added in this phase, which is exactly what it is for.

---

## Phase 3 — Slot engine rewrite ✅ DONE

Pure functions only. No DB calls inside the generator — that is what makes it
testable, and `docs/booking-flow.md` is emphatic about it.

| File | Action | Result |
|---|---|---|
| `lib/slots.ts` | **rewrite** | ✅ `generateSlots(GenerateSlotsInput): Slot[]`, plus `clinicDateKey`, `clinicTimeToUtc`, `utcToClinicTime`, `intervalsOverlap` |
| `lib/availability.ts` | **new** | ✅ `getAvailableSlots` (one dentist) and `getAvailableSlotsAcrossDentists` (the "No preference" union) |
| `tests/unit/slots/` | **new** | ✅ `slots.basic` (17) · `slots.overlap` (10) · `slots.dst` (9) · `slots.duration` (10) — 46 tests |
| `tests/unit/slots.test.ts` | **deleted** | ✅ replaced; it tested the old string-based algorithm |
| `lib/constants.ts` | fix | ✅ temporal-dead-zone bug — **see below** |
| `prisma/schema.prisma` | fix | ✅ comments claimed `start_time`/`end_time` are UTC; `docs/database.md:34` says clinic-local. Comments only, no migration |
| `types/index.ts` | fix | ✅ removed the dead `TimeSlot` type (old output shape, nothing referenced it) |
| `docs/booking-flow.md` | fix | ✅ v2 `date-fns-tz` names, test paths, DST rationale, validator filename |

**Gate met:** `typecheck` ✅ · `lint` ✅ · `test` ✅ **104/104** (was 67) · `build` ✅

### What actually changed in the algorithm

The old generator stepped by service duration over `"HH:mm"` strings with no
timezone handling at all. The new one steps a UTC cursor on a 15-minute grid and
converts only at the edges, via `date-fns-tz` exclusively.

Note that `date-fns-tz` v3 renamed the two functions the doc named: they are
`fromZonedTime` / `toZonedTime` now, not `zonedTimeToUtc` / `utcToZonedTime`.
The doc has been corrected.

### DST: the round-trip check does not do what the doc assumed

Measured against `date-fns-tz` 3.2.0 at both Sydney transitions:

| Case | `fromZonedTime` behaviour |
|---|---|
| Spring forward, `02:00` on 2026-10-04 | → `15:00Z`, which is **01:00 local** — resolves *backwards* into the previous hour |
| Fall back, `02:00` on 2026-04-05 | → `16:00Z`, the **second** (AEST/standard) occurrence |

Two consequences the plan did not anticipate:

1. **Stepping the cursor in UTC already prevents the spring-forward over-count
   from candidates**, because UTC is continuous — the local clock jumps from
   01:45 to 03:00 on its own and no nonexistent time is ever generated. The
   over-count instead comes from the *window bound*: an availability row
   declared 02:00–05:00 has `windowStartUtc` resolve back to 01:00 local, and
   the round-trip check does **not** catch that (01:00 round-trips fine). The
   fix is a re-check of each candidate against the window's declared **local**
   bounds. `slots.dst.test.ts` covers it.
2. **The fall-back case is decided by the storage model, not by preference.** An
   appointment is `(appointment_date, "HH:mm")` in clinic-local terms, so of the
   two real 02:00 instants only one is representable — and two would collide on
   `appointments_active_slot_unique` anyway. The round-trip check keeps exactly
   the occurrence `clinicTimeToUtc` resolves to, which is by construction the
   one the booking path will re-derive from the patient's chosen time. For
   Sydney that is the second occurrence, matching what the doc asked for.

So both DST directions fall out of two cheap checks, and generator and booker
can never disagree about which instant a displayed "HH:mm" means. The `Set` on
the ISO UTC string is retained, but its real job is deduping overlapping
availability rows.

### A latent crash in `lib/constants.ts`, found by the first test that imported it

`CLINIC_TIMEZONE` is initialised at module load by `resolveTimezone(...)`, which
returns `DEFAULT_TIMEZONE` — a `const` declared *below* it. Function declarations
hoist; `const` does not. So the fallback path threw:

```
ReferenceError: Cannot access 'DEFAULT_TIMEZONE' before initialization
```

Invisible until now because every previous caller had `CLINIC_TIMEZONE` set in
`.env` and took the early-return branch. Vitest does not load `.env`, so the
first test to import the module hit it immediately. The file's own header
promises that "a missing variable degrades predictably instead of failing at
import time" — it did the opposite. `DEFAULT_TIMEZONE` now precedes its use.

**Worth knowing for Phase 6:** a Vercel deploy that forgets `CLINIC_TIMEZONE`
would have crashed every route that imports `lib/constants.ts`, at import time,
with an error naming neither the variable nor the cause.

### Deviations from the spec, and why

1. **Day-of-week is read from `date`'s UTC parts, not by converting to the
   clinic timezone.** The doc says convert; that works for Sydney but is wrong
   for any zone behind UTC, where UTC midnight is the *previous* local day.
   Since `date` is defined as UTC midnight *of the clinic-local day*, its UTC
   parts already are the clinic-local calendar date.
2. **`timezone` and `stepMinutes` are both optional**, defaulting to
   `CLINIC_TIMEZONE` and `SLOT_STEP_MINUTES`. The doc's type marked `timezone`
   required while its comment said "'Australia/Sydney' by default".
3. **A non-positive `stepMinutes` throws `RangeError`; a non-positive duration
   returns `[]`.** The first is a programming error, the second is bad service
   data. The loop also has a hard candidate cap so it cannot spin.
4. **`getAvailableSlotsAcrossDentists` was built now rather than in Phase 5.**
   `docs/booking-flow.md` puts the "No preference" union in step 3 of the
   wizard, which is this phase's surface, and `/api/availability` needs it. Three
   queries total; per-dentist generation runs in memory.
5. **`serviceDurationMinutes` is an input to the wrapper, not a `serviceId` it
   looks up.** Every caller has to fetch the service anyway to check
   `isActive` — see the edge case table in `docs/booking-flow.md`.

### Verified against the live database

Not part of the stated gate, but `lib/availability.ts` is the one piece unit
tests cannot reach. Against the seeded Sydney project:

| Check | Result |
|---|---|
| Dr. Smith, Friday 09:00–15:00, 30-min service | 19 slots, 10:00 → 14:30 ✅ |
| Existing 09:00–10:00 appointment | 09:00–09:45 correctly withheld ✅ |
| 10:00 Sydney (AEST, +10) | `2026-08-28T00:00:00.000Z` ✅ |
| "No preference" union across 3 dentists | 35 slots, starting 08:00 ✅ |
| A Sunday, nobody rostered | 0 slots ✅ |

## Phase 4 — Appointment domain ✅ DONE

```
lib/appointments/
  index.ts        barrel — `docs/api-conventions.md` imports from `@/lib/appointments`
  create.ts       three-layer race prevention + "no preference" load balancing
  transition.ts   the state machine — the ONLY code path that writes `status`
  queries.ts      list / get, always scoped by the actor
  actor.ts        session -> Actor, resolving a DENTIST's `Dentist.id`
  time.ts         stored (date, "HH:mm") <-> absolute instants
```

| File | Action | Result |
|---|---|---|
| `lib/appointments/*` | **new** | ✅ six modules, above |
| `lib/slots.ts` | extend | ✅ added `utcToClinicDateKey` — the instant→calendar-date counterpart to `clinicDateKey` |
| `lib/validators/appointment.ts` | fix | ✅ `dentistId` now `.nullable()`; notes capped at `MAX_NOTES_LENGTH` (1000, was 500); `availabilityQuerySchema.dentistId` nullish |
| `tests/unit/appointments/` | **new** | ✅ `transition` (24) · `time` (6) |
| `tests/integration/` | **new** | ✅ `booking.race` (4) · `booking.create` (12) · `booking.transition` (10) |
| `vitest.integration.config.ts`, `pnpm test:integration` | **new** | ✅ see below |

**Gate met:** `typecheck` ✅ · `lint` ✅ · `test` ✅ **134/134** (was 104) · `build` ✅ ·
`test:integration` ✅ **26/26** against the live Supabase database.

### The race gate: passed, and Layer 2 is what catches it

`booking.race.test.ts` fires concurrent `createAppointment` calls at one slot.
Exactly one wins; the loser gets `ConflictError`. Instrumented over repeated
runs, the sequence is consistently:

```
[booking] bookingConflict { layer: 'tx', retrying: true, ... }
[booking] bookingConflict { layer: 'tx', ... }
```

— the Serializable transaction fails with a write conflict, the single retry
runs, and the retry then sees the winner's committed row and rejects cleanly.
**Layer 3 (the partial index) never fired**, which is the expected division of
labour: it only sees exact start-time collisions that slip past Layer 2.

Two details worth recording:

1. **The two bookings must use different patients.** With one patient, the
   "you already have an appointment then" check rejects the second on its own
   and the test passes without ever exercising the race layers. It is an easy
   test to write wrong.
2. **Prisma interactive transactions at Serializable work through Supabase's
   PgBouncer pooler.** This was the open risk — transaction-mode pooling breaks
   some session-scoped features — and it is now measured, not assumed.

A fourth case asserts a cancelled slot becomes bookable again, which is the
Phase 0 partial-index fix paying off end to end.

### Known limitation: overlap is compared on local wall clock

Both the in-transaction overlap query and `appointments_active_slot_unique`
compare `start_time`/`end_time` as `"HH:mm"` strings, exactly as
`docs/booking-flow.md` prescribes. On the one fall-back day a year this is
*conservative but not exact*: an appointment stored 01:45–02:15 (14:45–15:15Z)
and one stored 02:00–02:30 (16:00–16:30Z) are disjoint in real time, but the
string comparison reports an overlap and refuses the second.

It errs toward refusing a legal booking rather than allowing a double-book,
which is the right direction to be wrong in. Making it exact would mean storing
UTC instants on `appointments`, which is a schema change well outside this
phase. Flagged rather than fixed.

### Status writes go through one door

`transition.ts` owns the table from `booking-flow.md` and is the only code that
writes `status`. Beyond the documented rules it adds one thing the doc does not
specify: the read and the write share a transaction, and the `updateMany` guards
on the status it expected to find. Two admins clicking Confirm and Cancel at the
same instant therefore cannot both succeed — the second matches zero rows and is
rejected instead of silently overwriting the first. Covered by
`booking.transition.test.ts`.

Ownership is checked *before* the state rules, deliberately: otherwise a
stranger probing a cancelled appointment would get "already cancelled", which
confirms it exists. Everything unauthorised answers `NotFoundError`.

### Integration tests: a second vitest project

`pnpm test` stays hermetic and fast (134 unit tests, ~3s, no network).
`pnpm test:integration` runs the DB-backed suites via
`vitest.integration.config.ts`, which loads `.env` through a small setup file —
vitest does not read it, and these suites need `DATABASE_URL` and
`CLINIC_TIMEZONE`. Every suite is `describe.skipIf(!hasDatabase)`, so a checkout
without `.env` skips rather than fails.

Fixtures create their own users, dentists, services and availability, and tear
them down in `afterAll`. Verified after the run: 14 users / 3 dentists /
5 services / 20 appointments — the seed state, untouched.

One fixture wrinkle worth knowing: `getAvailableSlotsAcrossDentists` unions
*every* active dentist in the database, seeded ones included, so the "no
preference" tests would otherwise depend on whatever the seed contains. They use
a **Sunday** — the one weekday no seeded dentist works — so only the fixtures are
rostered.

### Open questions, now answered

1. **Reschedule: deferred.** No UI entry point exists, it needs a
   `rescheduledFromId` column plus a migration (and that migration is precisely
   where `migrate dev` will try to drop the partial index), and cancel-then-book
   already works as two user actions. `lib/appointments/reschedule.ts` is
   therefore **not** in this phase, and the schema is unchanged — Phase 4 shipped
   with no migration at all.
2. **Dentist write access: confirm, complete, and cancel — their own
   appointments only.** Exactly the state machine table; dentist-initiated
   booking stays post-launch. `resolveActor` refuses a DENTIST session whose
   dentist row is missing or deactivated, since that is a broken account rather
   than an authorization near-miss.
3. **`zxcvbn`: still open.** Untouched by this phase; it is a dependency add and
   a UX change.
4. **`appointmentDate` kept** (it matches the Prisma column; the doc was the
   drifted side, and `docs/booking-flow.md` has been corrected). **`dentistId` is
   now `.nullable()`**, so the booking form's long-standing "No preference"
   option can finally be submitted.

### Deviations worth knowing

1. **The patient double-book check lives in `create.ts`, not in a Zod
   refinement.** `booking-flow.md` files it under `createAppointmentSchema`, but
   it needs a database read, which Zod cannot do at the boundary.
2. **`createAppointment` takes `bookedByAdmin`** to skip the email-verification
   precondition, per "Preconditions" — admins booking a walk-in bypass
   verification but run the same slot logic.
3. **Load balancing counts only PENDING and CONFIRMED** appointments that day.
   Counting cancellations would penalise a dentist for other people's changes of
   mind. Ties break by dentist id, so a retried request lands on the same
   dentist.
4. **Observability is `console.info` for now.** `bookingAttempted` and
   `bookingConflict` (with `layer`) are emitted as the doc specifies; Phase 6
   points them at Sentry alongside the rest of the instrumentation.

## Phase 5 — Server actions + route handlers ✅ DONE

Per `api-conventions.md`: **mutations are Server Actions; route handlers are only
for cron, file downloads, webhooks, and external callers.**

### Server actions — `lib/actions/`

| File | Actions |
|---|---|
| `appointments.ts` | `bookAppointment`, `cancelAppointment` |
| `profile.ts` | `updateMyProfile`, `changeMyPassword` |
| `admin/appointments.ts` | `confirmAppointment`, `completeAppointment`, `cancelAppointmentAsStaff`, `updateAppointmentNotes` |
| `admin/dentists.ts` | create / update / deactivate |
| `admin/services.ts` | create / update / deactivate |
| `admin/availability.ts` | `setAvailabilityAction`, `blockDateAction`, `unblockDateAction` |

Every action re-checks the role in the action body — middleware reads the JWT and
cannot see a role revoked after the token was issued.

**`lib/action-result.ts` — new.** Actions return
`{ ok: true, data } | { ok: false, error: { code, message, details? } }` and never
throw. A thrown error in a Server Action reaches the browser as an opaque digest
in production and a stack trace in development; neither is useful. `runAction`
funnels through the same `toHttpError` the route handlers use, so an action and
its equivalent endpoint answer identically. It lives outside the `"use server"`
files because such a module may only export async functions.

### Route handlers — all 10 stubs replaced, 6 routes added

| Route | Methods |
|---|---|
| `/api/services`, `/api/dentists` | GET, public, active only |
| `/api/availability` | GET — `dentistId` omitted returns the union across active dentists |
| `/api/appointments` · `/[id]` | GET own · GET/PATCH (cancel), scoped by session |
| `/api/admin/appointments` · `/[id]` | GET · PATCH (status and/or notes) |
| `/api/admin/dentists`, `/services`, `/patients` | GET |
| `/api/admin/availability` | GET, **PUT** (replace a whole roster) |
| `/api/admin/blocked-dates` · `/[id]` | GET/POST · DELETE |
| `/api/patient/profile` | GET, PATCH |
| `/api/admin/export` | GET → `.xlsx` |

`/api/cron` is untouched — Phase 6 moves it to `/api/cron/reminders`.

**No `POST /api/appointments`.** `api-conventions.md` lists one, but `CLAUDE.md`
and the same doc's own "When to use what" table both say user-initiated
mutations are Server Actions. Booking goes through `bookAppointment`; adding a
second write path to the most safety-critical operation in the system would mean
two places to keep the race layers and rate limiting correct.

### New `lib/` modules

`catalogue.ts` (public service/dentist reads, publishable fields only),
`profile.ts`, `patients.ts`, `stats.ts`, `format.ts` (one place that renders a
booking, so the "read `@db.Date` in UTC" rule is applied once),
`admin/{dentists,services,availability}.ts`, `appointments/notes.ts`.

`notes.ts` is separate from `transition.ts` deliberately: it does not touch
`status`, and adding a second entry point to that column would quietly undo the
single-writer guarantee.

### Mocks removed

Every item on the list, all now reading live data:
patient dashboard · patient appointments · admin dashboard (including the
hardcoded "247 patients") · booking form · cancel button · profile form ·
admin appointments / patients / dentists / services / export.

**Left alone: `components/landing/{services,dentists}-section.tsx`.** Not on the
plan's list, and they carry marketing-only fields with no schema equivalent —
emoji icons, gradient classes, "popular" flags, qualifications. Wiring them would
mean either losing that content or adding columns for it. Flagged as an open
item, not silently expanded into.

### Decisions and fixes worth knowing

1. **The admin status dropdown only offers legal transitions.** It used to list
   all four statuses, so staff could pick one the state machine was always going
   to reject. `allowedTargets` mirrors the table in `booking-flow.md`:
   PENDING → Confirm/Cancel, CONFIRMED → Cancel (plus Complete once the visit has
   actually finished), and terminal states render a plain badge.
2. **`changePasswordSchema` still required only 8 characters** — `security.md:32`
   says 10, and Phase 2 raised registration and reset but missed this file. Fixed,
   with the UI copy.
3. **The booking form had two navigation bars on step 3.** Both `step < 3` and
   `step === 2` rendered one. Merged, and step 4 gained the Back button it never
   had.
4. **Export is fetched, not navigated to.** A plain link to a failing endpoint
   replaces the page with a raw error document; fetching lets the error surface
   as a toast. The blob URL is revoked after the click — it holds patient data.
5. **The date the patient picks is read from local date parts, not
   `toISOString()`.** The calendar hands back midnight in the browser's zone, and
   serialising that through UTC shifts the day backwards for everyone east of
   Greenwich — which is every patient of a Sydney clinic.
6. **New dentists get no password.** `createDentist` makes the user and dentist
   rows in one transaction; the dentist sets their own credential through the
   reset flow, which also verifies their mailbox. No password passes through an
   admin's hands.
7. **Deactivating a dentist or service reports what it leaves behind.** Neither
   cancels existing appointments — the same rule blocked dates follow — so the
   count comes back and the toast says so.

### Gate: passed end to end against the live database

`typecheck` ✅ · `lint` ✅ · `test` ✅ 134/134 · `build` ✅ · `test:integration` ✅ 26/26

Then, against `pnpm dev` and Supabase:

| # | Check | Result |
|---|---|---|
| 1 | `/api/services`, `/api/dentists`, `/api/availability` unauthenticated | 200 with real rows; 09:00 Sydney → `23:00Z` the previous day (AEST) ✅ |
| 2 | "No preference" availability | slots tagged with `dentistIds` ✅ |
| 3 | Bad input | `{"error":{"code":"VALIDATION_ERROR",…,"details":{"date":"Invalid date format"}}}` ✅ |
| 4 | All protected endpoints, no session | 401 ✅ |
| 5 | Patient hitting `/api/admin/*` | 403 ✅ |
| 6 | Patient → `/admin`; admin → `/book` | 307 to `/dashboard` and `/admin` ✅ |
| 7 | Six admin pages as ADMIN | 200 ✅ |
| 8 | **Book a real appointment** | row written, `09:00`–`09:30`, PENDING ✅ |
| 9 | Slot disappears from availability | first offered becomes 09:30 ✅ |
| 10 | Shows on patient dashboard, appointments page (with notes), admin table | ✅ |
| 11 | **Patient cancels it** | CANCELLED ✅ |
| 12 | **Slot bookable again** | 09:00 offered once more — the Phase 0 partial index, proven end to end ✅ |
| 13 | A different patient tries to cancel it | `NOT_FOUND`, not `FORBIDDEN` ✅ |
| 14 | Admin confirms PENDING → CONFIRMED | ✅ |
| 15 | CONFIRMED → COMPLETED before the visit | "This appointment has not finished yet" ✅ |
| 16 | CONFIRMED → PENDING | "Cannot change an appointment from confirmed to pending" ✅ |
| 17 | Notes-only PATCH, and an empty PATCH | saved · "Nothing to update" ✅ |
| 18 | Excel export as ADMIN / as PATIENT | real `.xlsx` with the right headers · 403 ✅ |

Test rows were removed afterwards; the database is back to seed state — 20
appointments, same status distribution.

### Not done in this phase

**Dentist profile photo upload.** `docs/api-conventions.md` has no endpoint for
it and the Supabase anon/service-role keys are still empty, which was flagged as
a Phase 5 prerequisite. `profilePhotoUrl` exists on the model and can be set
through `updateDentistAction`, but there is no upload UI and no Supabase Storage
integration. **Add the keys and this becomes a small, self-contained piece of
work; until then a dentist photo can only be set to an existing URL.**

## Phase 6 — Cron, reminders, deploy ✅ DONE

| File | Action | Result |
|---|---|---|
| `lib/reminders.ts` | **new** | ✅ the 23-25h sweep, claim-before-send |
| `app/api/cron/reminders/route.ts` | **new** | ✅ constant-time `CRON_SECRET` check before any DB access |
| `app/api/cron/route.ts` | **deleted** | ✅ the stub was at the wrong path |
| `vercel.json` | extend | ✅ hourly cron added to the existing `syd1` pin |
| `sentry.{client,server,edge}.config.ts`, `sentry.shared.ts` | **new** | ✅ initialised via `instrumentation.ts` |
| `components/shared/sentry-init.tsx` | **new** | ✅ browser init without `withSentryConfig` |
| `playwright.config.ts`, `tests/e2e/` | **new** | ✅ 3 scenarios, all green |
| `tests/integration/reminders.test.ts` | **new** | ✅ 10 tests |
| `lib/auth.config.ts` | fix | ✅ `trustHost` — **a production bug, see below** |
| `README.md` | rewrite | ✅ was untouched `create-next-app` boilerplate |
| `CLAUDE.md` | fix | ✅ `{{Clinic Name}}` → BrightSmile Dental, `{{Australia/Sydney}}` → Australia/Sydney |

**Gate met:** `typecheck` ✅ · `lint` ✅ · `test` ✅ 134/134 · `build` ✅ ·
`test:integration` ✅ **36/36** (was 26) · `e2e` ✅ **3/3**

### The e2e suite immediately found a production bug

Every authenticated request in a production build answered 500:

```
[auth][error] UntrustedHost: Host must be trusted. URL was: http://localhost:3000/api/auth/session
```

NextAuth v5 refuses any request whose host it cannot verify, and outside
development it only auto-trusts when it detects Vercel. `pnpm dev` was fine, so
five phases of curl-and-browser testing never touched it — the first `pnpm build
&& pnpm start` did. Fixed with `trustHost: true` in `authConfig`.

**On Vercel this would probably have worked**, since the SDK auto-detects
`VERCEL=1`. But `pnpm start` was broken for anyone running the production build
locally, the runbook's own deploy smoke test would have been the first thing to
hit it on a non-Vercel host, and relying on provider auto-detection for
something this load-bearing is not a decision anyone made deliberately.

This is the argument for e2e against a production build rather than a dev
server, in one bug.

### Reminders: claim-before-send, not send-inside-a-transaction

`docs/booking-flow.md` says the `reminder_sent = true` flip should happen "in the
same transaction as the DB read". Implemented literally that means an
interactive Prisma transaction wrapping two third-party HTTP calls:

```ts
await prisma.$transaction(async (tx) => {
  await sendWhatsApp(...);   // Twilio, over the network
  await sendEmail(...);      // Resend, over the network
  await tx.update({ reminderSent: true });
});
```

Prisma's default interactive-transaction timeout is 5 seconds. Twilio plus
Resend can exceed that on a bad day, and every second is a Postgres transaction
held open on a pooled serverless connection. That is a connection-exhaustion
bug waiting for the clinic's busiest morning.

**What was built instead:** claim the appointment first with a conditional
update on `reminder_sent = false`, then send outside any transaction.

```ts
const claim = await prisma.appointment.updateMany({
  where: { id, reminderSent: false },
  data: { reminderSent: true },
});
if (claim.count === 0) continue;  // someone else has it
```

This gives a *stronger* guarantee than the doc asked for — it holds against two
cron invocations running concurrently, not just sequentially — with no
transaction open across the network. It is consistent with the doc's own
philosophy: delivery is deliberately at-most-once, because "a late reminder is
worse than no reminder". Both properties are asserted in
`tests/integration/reminders.test.ts`, including a genuinely concurrent
`Promise.all` of two sweeps.

### The window cannot be a SQL range

`booking-flow.md` writes the query as `startUtc: { gte: plusHours(now, 23), lt:
plusHours(now, 25) }`. There is no `start_utc` column — appointments store a
clinic-local calendar date and an `"HH:mm"` wall clock. The sweep therefore
narrows to the one or two clinic dates the window can touch, then computes each
candidate's real start instant and range-checks in memory. At clinic scale that
is a handful of rows per run.

### Sentry without `withSentryConfig`

The usual wrapper injects the SDK through webpack, but it also re-bundles
`@sentry/nextjs` — which `next.config.mjs` deliberately keeps external to avoid
the OpenTelemetry "Critical dependency" warning that Phase 1 removed.
`instrumentation.ts` initialises the Node and edge runtimes instead, and a small
client component covers the browser (Next 14 only auto-loads
`sentry.client.config.ts` through the wrapper).

Two consequences:

1. **No automatic source-map upload.** Production stack traces will be minified
   until `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT` are set and
   `withSentryConfig` is wired back in. Worth doing before launch; not worth the
   build complexity now.
2. **The edge bundle grew 77 kB → 131 kB**, because `sentry.edge.config.ts` is
   pulled into `middleware.ts`. Well inside Vercel's limit, but it is real
   weight on every request through the session gate. Dropping the edge config
   would recover it; the trade is losing error reporting from middleware.

Session replay is off and `sendDefaultPii` is false — this app handles patient
data, and replay would record people typing medical notes.

### Cron gate: passed live

| Check | Result |
|---|---|
| No `Authorization` header | 401 ✅ |
| Wrong secret | 401 ✅ |
| Right secret, wrong scheme (no `Bearer `) | 401 ✅ |
| Correct header | 200 ✅ |
| **Prisma queries issued by unauthorised calls** | **0** — measured, not assumed ✅ |
| Old `/api/cron` path | 404 ✅ |
| Appointment 24h out, one sweep | 1 claimed, 1 delivered ✅ |
| Second sweep, same hour | 0 claimed — no double-send ✅ |
| WhatsApp unconfigured | throws, email still sent, `reminderSent` still set ✅ |

The secret is compared with `timingSafeEqual` over fixed-width buffers, and an
unset `CRON_SECRET` refuses every request rather than defaulting to open.

### E2E scenarios

All three from `booking-flow.md`, against a production build in a real browser:

1. A patient books through the full wizard — including "No preference", which
   exercises the load-balancing path — and sees the appointment on their own
   pages, with the row asserted in the database as `PENDING`.
2. A patient with an appointment 12 hours away sees the "call the clinic"
   message instead of a cancel button, **and** the API refuses the cancellation
   with 422 when called directly.
3. An admin confirms a pending appointment and the patient sees `Confirmed`.

Fixtures tag every row they create and delete them afterwards; verified after the
run — 20 appointments, 14 users, 3 dentists, 5 services, exactly the seed state.

Browsers are not vendored: `npx playwright install chromium` once.

## Timeline

| Phase | Effort | Status |
|---|---|---|
| 0 — Runnable | 0.5d | ✅ done |
| 1 — Foundation | 1d | ✅ done |
| 2 — Auth | 1.5d | ✅ done, e2e verified |
| 3 — Slot engine | 2.5d | ✅ done, verified live |
| 4 — Domain | 3.5d | ✅ done, race gate passed |
| 5 — Actions + handlers | 4d | ✅ done, e2e verified |
| 6 — Cron + deploy | 2d | ✅ done, cron + e2e verified |
| **Total** | **~15 working days (3 weeks)** | |

**Critical path:** 0 → 1 → 3 → 4 → 5. Phase 2 blocks manual testing but not
compilation, so with two people Phases 2 and 3 run in parallel and the whole thing
lands in ~11 days.

---

## Definition of done, per phase

Every phase ends with `pnpm typecheck && pnpm lint && pnpm test` green — that is
the `CLAUDE.md` rule and Phase 0 has established the baseline, so any breakage
from here is newly introduced and attributable.

Additionally, per the security checklist, each phase's PR confirms:

- [ ] All inputs validated with Zod at the boundary
- [ ] All queries scoped to the current user where applicable (no IDOR)
- [ ] Role checks in the handler, not just middleware
- [ ] Rate limiting on auth + booking endpoints
- [ ] No secrets in the client bundle
- [ ] Cron endpoints check `CRON_SECRET`
- [ ] Loading / empty / error states for any new UI surface

---

## Open questions

Phase 4's blockers were answered before it was built — recorded in full under
"Phase 4 → Open questions, now answered". In short:

1. ~~**Reschedule in MVP, or defer?**~~ **Deferred.** No UI entry point, needs a
   schema column, and cancel-then-book covers it. Revisit post-launch.
2. ~~**Do dentists get write access?**~~ **Yes, scoped to their own
   appointments:** confirm, complete, cancel. Dentist-initiated booking stays
   post-launch.
3. ~~**`date` vs `appointmentDate` in the validator.**~~ **`appointmentDate`
   kept**; `docs/booking-flow.md` corrected. `dentistId` is now `.nullable()`.

### Still open

- **`zxcvbn` score >= 3.** `security.md:34` asks for it; the package is not a
  dependency and adding one is a product call. Length/letter/number rules are
  enforced today.
- **Overlap comparison on the fall-back day.** Conservative but not exact — see
  "Known limitation" under Phase 4. Fixing it means storing UTC instants on
  `appointments`.
- **Sentry source maps.** `instrumentation.ts` initialises the SDK but there is
  no `withSentryConfig`, so production stack traces stay minified until
  `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` are set. Worth doing
  before launch.
- **AI chat booking** — discussed separately, not in this plan. Its tools would
  wrap the endpoints built in Phase 5, so it belongs after them, not before.

### Not code, still pending

- Delete the old Tokyo Supabase project (free tier caps at 2 active projects).
- The repo is **public** — decide whether that is right before taking real
  patient bookings.
- **Supabase API keys (anon / service role) are still empty.** This is the one
  Phase 5 item left undone: dentist profile photo upload has no Supabase Storage
  integration and no upload UI. Add the keys from the Sydney project and it
  becomes a small, self-contained piece of work.
- `components/landing/{services,dentists}-section.tsx` still render hardcoded
  marketing content, including dentists who are not in the database. Wiring them
  needs a decision about where the marketing-only fields (icons, gradients,
  qualifications) should live.
- `CLAUDE.md` still carries unfilled template placeholders: `{{Clinic Name}}`,
  `{{Australia/Sydney}}`.

---

## Launch checklist

The server tier is finished. These are the remaining non-code items.

- [ ] **Decide whether the repo stays public.** It is public today. Nothing
      secret is committed — `.env` is ignored and the project ref lives only
      there — but this becomes a different question the moment real patient
      bookings exist.
- [ ] **Delete the old Tokyo Supabase project.** The free tier caps at two
      active projects.
- [ ] **Set every variable from `.env.example` in Vercel**, for Production and
      Preview. `AUTH_SECRET` and `CRON_SECRET` in particular — a missing
      `CRON_SECRET` makes the reminder endpoint refuse every request (by
      design), and a missing `CLINIC_TIMEZONE` now falls back safely but should
      still be set explicitly.
- [ ] **Supabase API keys (anon / service role).** Still empty. Dentist photo
      upload is the one Phase 5 item left undone and needs them.
- [ ] **Change the seeded `admin@demo.com` password.** `Admin123!` is 9
      characters — below the 10-character minimum — so that account works but
      cannot reset to its own password. Replace the seeded credentials before
      anyone real logs in.
- [ ] **Verify the Resend sending domain** and set `EMAIL_FROM` to it. Without a
      key, production email *throws* rather than silently dropping.
- [ ] **Configure Twilio WhatsApp** or accept email-only reminders. The sweep
      handles an unconfigured Twilio correctly — it logs and sends the email —
      so this is a launch decision, not a blocker.
- [ ] **Confirm the cron is registered** after the first deploy: Vercel →
      Cron Jobs. `vercel.json` declares it, but check it actually appears.
- [ ] **Wire `withSentryConfig`** if readable production stack traces matter.
- [ ] **`components/landing/{services,dentists}-section.tsx`** still render
      hardcoded marketing content, including dentists who are not in the
      database. Decide where the marketing-only fields (icons, gradients,
      qualifications) should live before launch.
