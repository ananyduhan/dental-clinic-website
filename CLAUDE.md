# CLAUDE.md

> This file is the single source of truth for how we build this project. Claude Code reads it automatically. Keep it concise. Detailed specs live in `docs/`.

---

## Project

**{{Clinic Name}}** — a production web app for a dental clinic. It handles:

- Public marketing site (landing, about, services, dentists, contact)
- Patient registration, login, profile
- Multi-step appointment booking with real-time slot availability
- Admin/dentist dashboard for managing appointments, dentists, services, patients
- Automated email + WhatsApp reminders 24h before appointments
- Excel export of appointment data

**Users:** patients (book appointments), admins (manage everything), dentists (view their schedule).

**Status:** pre-launch. Treat this as production code from day one.

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 14 (App Router) | TypeScript strict mode |
| Styling | Tailwind CSS + shadcn/ui | Custom design tokens — see `docs/design-system.md` |
| DB | PostgreSQL (Supabase) | |
| ORM | Prisma | All DB access goes through Prisma |
| Auth | NextAuth.js v5 | Credentials + email magic link |
| Validation | Zod | Used on every API boundary and form |
| Forms | react-hook-form + Zod resolver | |
| Email | Resend | |
| WhatsApp | Twilio WhatsApp Business API | |
| Scheduled jobs | **Vercel Cron** (NOT node-cron — serverless incompatible) | Configured in `vercel.json` |
| Excel export | `xlsx` | |
| Dates | `date-fns` + `date-fns-tz` | Clinic timezone: **{{Australia/Sydney}}** |
| Tests | Vitest (unit) + Playwright (e2e) | |
| Hosting | Vercel | |
| Storage | Supabase Storage | Dentist profile photos |
| Error tracking | Sentry | |
| Rate limiting | Upstash Redis | |

---

## Commands

```bash
# Development
pnpm dev                    # start dev server
pnpm build                  # production build
pnpm start                  # run production build locally
pnpm lint                   # eslint
pnpm typecheck              # tsc --noEmit
pnpm format                 # prettier write

# Database
pnpm db:migrate             # prisma migrate dev
pnpm db:push                # prisma db push (dev only — never prod)
pnpm db:studio              # open Prisma Studio
pnpm db:seed                # run seed script
pnpm db:reset               # reset + reseed (dev only)

# Tests
pnpm test                   # vitest
pnpm test:watch             # vitest watch mode
pnpm e2e                    # playwright
```

**Always run `pnpm typecheck && pnpm lint && pnpm test` before declaring a task done.**

---

## Repo Structure

```
app/
  (public)/        landing, login, register, forgot-password
  (patient)/       dashboard, book, appointments, profile  — auth required, role=PATIENT
  (admin)/         admin/*                                 — auth required, role=ADMIN|DENTIST
  api/             route handlers (used for webhooks, cron, external integrations)
components/
  ui/              shadcn primitives — DO NOT modify in place; copy + extend if needed
  landing/         landing-page sections
  booking/         multi-step booking flow
  admin/           admin dashboard pieces
  shared/          navbar, footer, layout primitives
lib/
  prisma.ts        singleton Prisma client
  auth.ts          NextAuth config
  email.ts         Resend helpers (one function per email type)
  whatsapp.ts      Twilio helpers
  slots.ts         slot generation (pure functions, fully unit-tested)
  export.ts        Excel export logic
  rate-limit.ts    Upstash rate limiter
  validators/      shared Zod schemas (one file per domain)
prisma/
  schema.prisma
  seed.ts
docs/              long-form specs — read these on demand, not every session
types/             shared TypeScript types
tests/             unit + e2e tests
```

---

## Architecture Rules

### Server vs client components
- **Default to Server Components.** Only mark `'use client'` when you need state, effects, or browser APIs.
- Data fetching happens in Server Components or server actions — **never** fetch from client components on mount unless there's a real reason (e.g. polling).

### Mutations
- **Use Server Actions for user-initiated mutations** (form submits, button clicks).
- **Use API route handlers** only for: webhooks (Twilio, Resend), cron jobs, things called by external systems, file downloads (Excel export).

### Data access
- All DB access goes through `lib/prisma.ts`. Never import `PrismaClient` directly elsewhere.
- Business logic lives in `lib/`, not in components or route handlers. Route handlers are thin wrappers: parse → validate → call lib → respond.

### Validation
- Every API route handler and server action validates input with Zod.
- Schemas live in `lib/validators/`. Reuse them on the client with react-hook-form.
- **No `any`. No unvalidated `request.json()`.**

### Auth & authorization
- Session check in middleware for `(patient)` and `(admin)` route groups.
- Role check in **every** server action and API route — middleware is not enough.
- Helper: `requireRole('ADMIN')` in `lib/auth.ts` — use it.
- IDOR check: a patient must only access their own appointments. Always filter by `session.user.id` in queries, not just by URL param.

### Errors
- Throw typed errors from `lib/errors.ts` (`NotFoundError`, `UnauthorizedError`, `ValidationError`, `ConflictError`).
- Map them to HTTP status codes in a single error handler.
- Never expose stack traces or raw Prisma errors to the client.
- Log all 5xx errors to Sentry with request context.

### Naming
- Files: `kebab-case.ts` (`appointment-card.tsx`, `slot-generator.ts`)
- Components: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Types/interfaces: `PascalCase`, no `I` prefix
- Booleans: `is*`, `has*`, `can*`, `should*`

### Imports
- Absolute imports via `@/*` alias.
- Order: external → `@/lib` → `@/components` → relative.

---

## Design System (Critical — see `docs/design-system.md`)

This product must NOT look AI-generated.

- **Use design tokens via CSS variables** defined in `app/globals.css`. Never hardcode colors.
- **Use the typography scale.** No arbitrary `text-[14px]`.
- **Spacing follows the 4px scale** (`p-1`, `p-2`, `p-4`, `p-6`, `p-8`, `p-12`, `p-16`).
- **Every interactive element has hover, focus-visible, active, and disabled states.**
- **Loading, empty, and error states are required** for every list, form, and async surface. Not optional.
- **Animations:** subtle, fast (150–250ms), `ease-out` for enter, `ease-in` for exit.

---

## Domain Rules

### Booking
- Slot generation logic in `lib/slots.ts`. Pure functions. Unit-tested.
- All times stored as **UTC** in DB. Convert to clinic timezone at the edges.
- **Race condition prevention:** wrap booking creation in a Prisma transaction with a check for overlapping appointments. A unique partial index on `(dentist_id, appointment_date, start_time)` enforces it at the DB level.
- Patients can only cancel/reschedule appointments **>24h away**.
- A patient cannot book if `email_verified = false`.
- A booked slot must not overlap with an existing PENDING or CONFIRMED appointment for that dentist.

### Reminders
- Vercel Cron hits `/api/cron/reminders` every hour.
- Endpoint must verify the `Authorization: Bearer ${CRON_SECRET}` header.
- Idempotent: setting `reminder_sent = true` happens in the same transaction as sending.
- If WhatsApp send fails, log the error but still send email and mark reminder_sent.

### Roles
- `PATIENT` — book/view own appointments.
- `DENTIST` — view their own schedule + patient details for their appointments.
- `ADMIN` — full access.

---

## Security Checklist (apply to every PR)

- [ ] All inputs validated with Zod.
- [ ] All DB queries scoped to current user where applicable (no IDOR).
- [ ] All admin/dentist routes have role checks in the handler, not just middleware.
- [ ] Passwords hashed with bcrypt, salt rounds = 12.
- [ ] Rate limiting on auth + booking endpoints.
- [ ] No secrets in client bundles. `NEXT_PUBLIC_*` only for truly public values.
- [ ] No `dangerouslySetInnerHTML` without sanitization.
- [ ] User-generated content escaped properly.
- [ ] Cron endpoints check `CRON_SECRET`.
- [ ] Email/phone numbers validated before sending.

---

## What NOT To Do

- ❌ Don't use `any` or `as unknown as X` to silence TypeScript.
- ❌ Don't put business logic in React components.
- ❌ Don't fetch data in client components on mount when a server component can do it.
- ❌ Don't use `localStorage` or `sessionStorage` — use cookies/server state. (Same for artifacts: not supported.)
- ❌ Don't hardcode colors, spacing, font sizes — use tokens.
- ❌ Don't reinvent components. Check `components/` first. If a Button exists, use it.
- ❌ Don't run `prisma db push` against production. Use migrations.
- ❌ Don't commit `.env`. Update `.env.example` when adding new variables.
- ❌ Don't use `node-cron` — it doesn't work in serverless. Use Vercel Cron.
- ❌ Don't write code without a plan for non-trivial tasks. Use `/plan` first.
- ❌ Don't skip loading/empty/error states.
- ❌ Don't merge a PR with failing typecheck, lint, or tests.

---

## Workflow for Any Non-Trivial Task

1. **Read** the relevant `docs/*.md` files (architecture, design-system, the feature spec).
2. **Plan** — produce a list of files to create/modify, the order, and any open questions. Wait for human approval before coding.
3. **Implement** in small, reviewable commits.
4. **Test** — unit tests for logic in `lib/`, e2e for critical user flows.
5. **Self-review** against the security checklist and design-system rules.
6. **Run** `pnpm typecheck && pnpm lint && pnpm test`.
7. **Update docs** if conventions changed.

For trivial tasks (typo fixes, copy changes, single-component tweaks), skip the plan step but still run checks.

---

## Definition of Done

A task is done when:

- [ ] Code matches conventions in this file.
- [ ] Typecheck passes (`pnpm typecheck`).
- [ ] Lint passes (`pnpm lint`).
- [ ] Tests pass (`pnpm test`) and new logic is covered.
- [ ] Loading, empty, and error states are implemented for any new UI surface.
- [ ] Accessibility: keyboard navigable, focus visible, labels on form fields, sufficient contrast.
- [ ] Manual smoke test in the browser.
- [ ] No new secrets in client bundle.
- [ ] `docs/` updated if conventions or architecture changed.
- [ ] Commit message describes the change clearly.

---

## Reference Docs

- `docs/architecture.md` — system overview, data flow diagrams
- `docs/design-system.md` — colors, typography, spacing, component patterns
- `docs/database.md` — schema, indexes, conventions
- `docs/api-conventions.md` — response shapes, status codes, validation patterns
- `docs/security.md` — auth, authorization, rate limiting, secrets
- `docs/booking-flow.md` — slot generation algorithm, race conditions, edge cases
- `docs/runbook.md` — operational procedures (post-launch)

Read these on demand. Do not load them all into every session.
