# Security

> Security reference for the dental clinic web app. This is a production system handling patient PII, health-adjacent data, and contact details (email, phone). Treat every decision with that weight.

This doc consolidates the security rules referenced in `CLAUDE.md` and expands on them. If anything here conflicts with `CLAUDE.md`, `CLAUDE.md` wins and this doc gets updated.

---

## Threat Model (at a glance)

| Actor | Capability | Primary risks |
|---|---|---|
| Unauthenticated visitor | Public pages, auth endpoints | Credential stuffing, account enumeration, spam registrations |
| Authenticated patient | Own dashboard, own appointments | IDOR into other patients' data, privilege escalation to ADMIN/DENTIST |
| Authenticated dentist | Own schedule + their patients | Accessing patients they don't treat, admin functions |
| Authenticated admin | Everything | Insider misuse, account takeover |
| External service (Twilio, Resend) | Webhooks | Forged webhook calls, replay attacks |
| Cron scheduler (Vercel) | `/api/cron/*` | Unauthorized triggering of reminder jobs |

---

## Authentication

### Provider
- **NextAuth.js v5** is the only auth surface. Do not roll custom session logic.
- Two methods supported: email + password (credentials) and email magic link.
- Sessions are cookie-based, `httpOnly`, `secure`, `sameSite=lax`.

### Passwords
- Hashed with **bcrypt, salt rounds = 12**. No exceptions. No SHA, no MD5, no plaintext — ever.
- Minimum policy (enforced with Zod on register + reset):
  - 10+ characters
  - At least one letter and one number
  - Rejected if found in a common-password list (use `zxcvbn` score ≥ 3)
- Passwords never logged, never returned in API responses, never included in error messages.
- Password reset tokens: single-use, 30-minute expiry, cryptographically random (32 bytes), stored as a hash in the DB.

### Email verification
- `users.email_verified` defaults to `false`.
- **A patient cannot book an appointment until `email_verified = true`.** Enforced in the booking server action, not just the UI.
- Verification tokens: single-use, 24-hour expiry, stored hashed.

### Magic links
- Single-use, 15-minute expiry.
- Rate-limited per email address (see below).
- Token stored hashed, compared in constant time.

### Account enumeration
- Login, registration, forgot-password, and magic-link endpoints must return **generic responses** that don't reveal whether an email exists.
  - Forgot password: always return 200 with "If an account exists, we've sent a link."
  - Login failures: always "Invalid email or password."
- Timing: use constant-time comparison for tokens and password hashes (bcrypt does this for passwords; use `crypto.timingSafeEqual` elsewhere).

---

## Authorization

### Roles
- `PATIENT` — book/view own appointments, edit own profile.
- `DENTIST` — view their own schedule and patient details for their appointments only.
- `ADMIN` — full access.

### Where checks happen
Role and ownership checks must happen in **three** places. Middleware alone is not enough.

1. **Middleware** — route-group gating (blocks unauthenticated access to `(patient)` and `(admin)`).
2. **Server action / route handler** — every single one calls `requireRole(...)` or `requireSession()` from `lib/auth.ts`.
3. **Query layer** — scoped by `session.user.id` so a patient can only read/write their own rows.

### IDOR prevention
- **Never trust an ID from the URL or request body.** Always filter queries by `session.user.id`.

```ts
// ❌ vulnerable
const appt = await prisma.appointment.findUnique({ where: { id: params.id } });

// ✅ correct
const appt = await prisma.appointment.findFirst({
  where: { id: params.id, patientId: session.user.id },
});
if (!appt) throw new NotFoundError();
```

- Dentists: filter appointments by `dentistId = session.user.dentistId`.
- Admins: no scoping, but still must pass `requireRole('ADMIN')`.

### Sensitive-action re-auth
- Changing password, changing email (admin-initiated), and deactivating a dentist require the actor to be freshly authenticated (session < 15 minutes old) or to re-enter their password.

---

## Input Validation

- Every API route handler and server action validates input with **Zod**. No `request.json()` goes unvalidated.
- Shared schemas live in `lib/validators/` (one file per domain: `auth.ts`, `appointments.ts`, `dentists.ts`, etc.).
- Reuse the same Zod schema on the client via `react-hook-form`'s Zod resolver so client and server validation stay in sync.
- **No `any`. No `as unknown as X`.** If you're tempted, the schema is wrong.

### What to validate
- Types, lengths, formats (email, phone, UUID).
- Enums (status values, roles, days of week).
- Date ranges (no appointments in the past, reasonable bounds on export date ranges).
- Phone numbers: validated and normalized to E.164 before storing or sending to Twilio.
- Emails: validated with a real parser (e.g. `zod.string().email()`), lowercased before storage.
- File uploads (dentist photos): MIME type check, size limit (max 5 MB), extension whitelist (`.jpg`, `.jpeg`, `.png`, `.webp`).

---

## Rate Limiting

Backed by **Upstash Redis** (`lib/rate-limit.ts`). Applied per IP and, where relevant, per identifier (email, user ID).

| Endpoint | Limit |
|---|---|
| `POST /api/auth/login` | 5 per 15 min per IP + per email |
| `POST /api/auth/register` | 3 per hour per IP |
| `POST /api/auth/forgot-password` | 3 per hour per email |
| `POST /api/auth/reset-password` | 5 per hour per IP |
| Magic link request | 3 per hour per email |
| Booking creation | 10 per hour per user |
| Export endpoint | 20 per day per admin |
| Public API (availability, dentists, services) | 60 per minute per IP |

Exceeding the limit returns `429` with a `Retry-After` header. Log rate-limit hits to Sentry at `warn` level so we can spot abuse patterns.

---

## CSRF

- NextAuth provides built-in CSRF protection for auth routes — keep it enabled.
- Server Actions are automatically CSRF-protected by Next.js (same-origin + opaque action IDs).
- API route handlers that accept mutations from the browser (not webhooks) must verify the request origin header against an allowlist.
- Webhook endpoints (Twilio, Resend) do **not** use CSRF tokens — they use signature verification (see below).

---

## Webhooks

### Twilio
- Verify every inbound webhook with `X-Twilio-Signature` using the auth token.
- Reject requests with missing or invalid signatures with `403`.
- Idempotency: Twilio may retry. Use the `MessageSid` as a dedup key.

### Resend
- Verify the webhook signature header using the shared secret.
- Same idempotency rule: use the event ID.

### Cron (Vercel Cron)
- `/api/cron/*` endpoints check `Authorization: Bearer ${CRON_SECRET}`.
- Requests without a valid secret return `401`. No body, no hints.
- Cron endpoints must be idempotent — see `docs/booking-flow.md` for the reminder-sent transaction pattern.

---

## Secrets & Environment Variables

### Rules
- **No secrets in the client bundle.** `NEXT_PUBLIC_*` is only for values safe to expose publicly (the app URL, the Supabase anon key if RLS is configured correctly — otherwise treat it as a secret).
- Never commit `.env`. Always update `.env.example` when adding new variables.
- Secrets live in Vercel project settings (and `.env.local` for local dev).
- Rotate secrets quarterly and immediately on suspected exposure.

### Required secrets
```
DATABASE_URL
NEXTAUTH_SECRET
RESEND_API_KEY
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_WHATSAPP_FROM
CRON_SECRET
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
SENTRY_DSN
SUPABASE_SERVICE_ROLE_KEY    # server-only, never exposed
```

### Publishable values
```
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY    # only if RLS is fully enforced
```

---

## Database Security

- All queries via Prisma — parameterized, no raw SQL unless reviewed.
- If raw SQL is unavoidable, use `prisma.$queryRaw` with tagged templates, never string concatenation.
- **Principle of least privilege:** the app's DB user has `SELECT/INSERT/UPDATE/DELETE` on app tables, no `DROP`/`ALTER`/`CREATE`.
- Migrations run via `prisma migrate deploy` in CI, never `db push` in production.
- Backups: Supabase handles daily backups on paid tier. Verify restore procedure quarterly (see `docs/runbook.md`).
- Unique partial index on `(dentist_id, appointment_date, start_time) WHERE status IN ('PENDING','CONFIRMED')` enforces no double-bookings at the DB level.

---

## XSS & Injection

- **Never** use `dangerouslySetInnerHTML` without sanitization via DOMPurify.
- All user-generated content (patient notes, admin notes, dentist bios) is rendered through React's default escaping — no manual HTML construction.
- Dentist bios are plain text only. If rich text is ever added, it goes through a strict allowlist sanitizer.
- Email templates: use a templating library that escapes by default. Never interpolate raw user input into HTML strings.

---

## Logging & PII

- **Never log:** passwords, password hashes, auth tokens, magic-link tokens, reset tokens, full phone numbers, full email addresses in error messages surfaced to users.
- **OK to log (server-side, Sentry):** user ID, request path, status code, partial email (`j***@example.com`), truncated phone (`+614****1234`), stack traces.
- Sentry: scrub PII fields via `beforeSend`. Configure `sendDefaultPii: false`.
- Retain application logs for 30 days unless a specific incident requires longer retention.

---

## Transport & Headers

All responses set these headers (via `next.config.js` or middleware):

- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` (or CSP `frame-ancestors 'none'`)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Content-Security-Policy`: restrictive, with nonces for inline scripts. Allow only:
  - `self` for scripts/styles
  - Twilio, Resend, Supabase, Upstash, Sentry endpoints for `connect-src`
  - Google Maps domains for the embedded map on the landing page
  - Supabase Storage for `img-src` (dentist photos)

HTTPS enforced by Vercel. All cookies `secure`.

---

## Error Handling

- Throw typed errors from `lib/errors.ts`: `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ValidationError`, `ConflictError`, `RateLimitError`.
- A single error handler maps them to HTTP status codes and a safe JSON shape.
- **Never expose:** stack traces, raw Prisma errors, internal IDs that leak structure, SQL fragments.
- 5xx errors are logged to Sentry with full context; the client sees only a generic "Something went wrong."

---

## Security Checklist (apply to every PR)

This is the checklist from `CLAUDE.md` — repeated here because it matters:

- [ ] All inputs validated with Zod.
- [ ] All DB queries scoped to current user where applicable (no IDOR).
- [ ] All admin/dentist routes have role checks in the handler, not just middleware.
- [ ] Passwords hashed with bcrypt, salt rounds = 12.
- [ ] Rate limiting on auth + booking endpoints.
- [ ] No secrets in client bundles. `NEXT_PUBLIC_*` only for truly public values.
- [ ] No `dangerouslySetInnerHTML` without sanitization.
- [ ] User-generated content escaped properly.
- [ ] Cron endpoints check `CRON_SECRET`.
- [ ] Webhook endpoints verify provider signatures.
- [ ] Email/phone numbers validated before sending.
- [ ] No PII in logs or error messages returned to the client.
- [ ] New secrets added to `.env.example` (with placeholder, never the real value).

---

## Incident Response

If a security incident is suspected (credential leak, suspicious access pattern, data exposure):

1. **Contain** — rotate the affected secret/credential immediately. Revoke active sessions if account takeover is suspected (`users.session_version` bump invalidates all JWTs for that user).
2. **Assess** — check Sentry, Vercel logs, Supabase audit logs for scope.
3. **Notify** — affected patients must be notified per the Australian Privacy Act / Notifiable Data Breaches scheme if personal info was likely accessed by an unauthorized party.
4. **Document** — write up root cause in `docs/incidents/YYYY-MM-DD-slug.md`.
5. **Fix + regression test** — patch and add a test that would have caught it.

Full procedure lives in `docs/runbook.md`.

---

## Dependencies

- `pnpm audit` runs in CI; the build fails on high or critical vulnerabilities.
- Dependabot/Renovate enabled for weekly PRs.
- Pin exact versions in `package.json` (no `^` on security-sensitive packages like `next-auth`, `bcrypt`, `zod`).
- Review any new dependency for: maintenance status, install size, transitive deps, known CVEs.

---

## Out of Scope (but worth naming)

These are not yet implemented. Track them as follow-ups:

- 2FA / TOTP for admin accounts.
- SSO (Google / Microsoft) for staff.
- Full audit log of admin actions (who changed what appointment, when).
- Automated PII data-subject-request export/deletion flow.
- Penetration test before public launch.

---

## See Also

- `docs/architecture.md` — system overview
- `docs/api-conventions.md` — response shapes, status codes
- `docs/booking-flow.md` — race-condition handling for bookings
- `docs/runbook.md` — operational + incident procedures
