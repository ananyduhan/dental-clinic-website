# Runbook

> Operational procedures for the Dental Clinic web app. Read this when something is broken, when deploying, or when performing a recurring operational task. Keep entries short, procedural, and tested.

**Stack reminder:** Next.js 14 on Vercel · Postgres on Supabase · Prisma · NextAuth v5 · Resend · Twilio WhatsApp · Vercel Cron · Upstash Redis · Sentry. Clinic timezone: **Australia/Sydney**.

---

## On-Call Quick Reference

| Symptom | First place to look | Runbook section |
|---|---|---|
| Site is down / 5xx spike | Vercel deployments, Sentry | [Incident response](#incident-response) |
| Patients can't log in | Sentry auth errors, Supabase status, Upstash rate-limit keys | [Auth failures](#auth-failures) |
| Bookings not saving | Sentry, Postgres locks, `appointments` unique index | [Booking failures](#booking-failures) |
| No reminders sent | Vercel Cron logs, `/api/cron/reminders`, Twilio/Resend status | [Reminders not firing](#reminders-not-firing) |
| WhatsApp not delivering | Twilio console, phone-number format | [WhatsApp delivery](#whatsapp-delivery-issues) |
| Emails not arriving | Resend dashboard, domain DNS | [Email delivery](#email-delivery-issues) |
| DB slow / timeouts | Supabase dashboard → Performance | [Database issues](#database-issues) |
| Export download broken | Vercel function logs | [Excel export](#excel-export-issues) |

**Escalation order:**
1. On-call engineer (rotation in team doc)
2. Tech lead
3. Clinic operations lead (for customer-facing comms)

---

## Deployments

### Standard deploy (production)

Production deploys on merge to `main` via Vercel.

1. Confirm CI is green (`pnpm typecheck && pnpm lint && pnpm test`).
2. Merge PR to `main`.
3. Watch the Vercel deployment logs until `Ready`.
4. Smoke test against the production URL:
   - Load landing page.
   - Log in as the seeded admin.
   - Load `/admin` dashboard.
   - Log in as a test patient.
   - Walk the booking flow through to the confirmation screen (cancel the test appointment afterward).
5. Check Sentry for new error types in the 10 minutes after deploy.

### Preview deploys

Every PR gets a preview URL. Use it for review. Preview deploys share the production Supabase unless `DATABASE_URL` is overridden — assume they do, and do not run destructive scripts against them.

### Rolling back

Vercel → Deployments → pick the last good deploy → **Promote to Production**.

Rollback is safe for code-only changes. If the bad deploy ran a DB migration, rolling back the code is not enough — follow [Migration rollback](#migration-rollback).

### Environment variables

Managed in Vercel → Project Settings → Environment Variables, one set per environment (Production, Preview, Development).

When adding a new variable:
1. Add to `.env.example` with a placeholder.
2. Add to Vercel in all three environments.
3. Add to local `.env` for any dev who needs it (share via 1Password, never Slack).
4. Redeploy — variable changes do not take effect until the next deployment.

Required variables are listed in the project spec under **Environment Variables Required**.

---

## Database

### Running migrations in production

1. Write the migration locally: `pnpm db:migrate` (this runs `prisma migrate dev`).
2. Commit the generated `prisma/migrations/*` directory.
3. On merge to `main`, the Vercel build step runs `prisma migrate deploy` automatically.
4. Verify after deploy: open Supabase → Table Editor → confirm the change.

**Never run `pnpm db:push` against production.** It bypasses the migration history and corrupts it.

### Migration rollback

Prisma does not support auto-rollback. To undo a bad migration:
1. Write a new forward migration that reverses the change.
2. Deploy it through the normal flow.
3. If the bad migration caused data loss, restore from the most recent Supabase backup first (see [Backups](#backups)).

Do **not** edit or delete applied migration files in `prisma/migrations/`. It desyncs the migration history.

### Backups

Supabase runs daily automated backups on the free tier (retention varies by plan — check current retention in the Supabase dashboard). For safety, take a manual snapshot before any risky migration.

**Manual backup:**
```bash
pg_dump "$DATABASE_URL" --no-owner --no-acl -Fc -f backup-$(date +%Y%m%d-%H%M).dump
```
Store in a secure location (not the repo). Test restores quarterly.

### Restore from backup

1. Create a new Supabase project or use a non-production branch.
2. `pg_restore --no-owner --no-acl -d "$RESTORE_DATABASE_URL" backup-file.dump`
3. Verify row counts against the backup source.
4. Only then point production at it — and only after a team decision, because it means accepting data loss between the backup time and now.

### Seeding

`pnpm db:seed` runs `prisma/seed.ts`. This creates the demo admin, dentists, services, and sample appointments listed in the spec.

**Never run seed against production.** The script is gated on `NODE_ENV !== 'production'`; keep it that way.

### Common DB tasks

**Promote a user to admin:**
```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'person@example.com';
```

**Reset a patient's email verification (rare — e.g. bounced verification email):**
```sql
UPDATE users SET email_verified = false WHERE email = 'patient@example.com';
```
Then trigger a resend via the admin UI or ask them to re-register.

**Find orphaned appointments (patient deleted elsewhere):**
```sql
SELECT a.* FROM appointments a
LEFT JOIN users u ON u.id = a.patient_id
WHERE u.id IS NULL;
```

---

## Incident Response

### Severity levels

| Sev | Definition | Response time |
|---|---|---|
| SEV-1 | Site down, data loss, security breach | Immediate, all hands |
| SEV-2 | Booking broken, reminders not sending, auth broken for >10% of users | Within 30 min |
| SEV-3 | Partial feature broken, affects <10% of users | Within business hours |
| SEV-4 | Cosmetic, non-blocking | Next sprint |

### Standard response flow

1. **Acknowledge** in the team channel — claim the incident so there isn't duplicate investigation.
2. **Assess** — is the site reachable? Is the DB reachable? Is it one user or all users? Check Sentry issue volume.
3. **Communicate** — if patient-facing and SEV-1/2, ask the clinic ops lead to post a notice on the clinic's social channels.
4. **Mitigate** — roll back if a recent deploy is the likely cause. Don't debug forward when rollback is available.
5. **Fix** — only after mitigation.
6. **Post-mortem** — for every SEV-1 and SEV-2, within 48 hours. Template in `docs/post-mortems/`.

### Site is down

1. Vercel → Deployments — is the latest deploy in `Error` state? Roll back.
2. Vercel status page (`status.vercel.com`) — is Vercel itself degraded?
3. Supabase status page — is the DB up?
4. If all green and site is still down: check Sentry for a spike of a specific error type. Common causes:
   - Missing/misconfigured env var after a recent change.
   - A migration that took a lock and timed out requests.
   - Runaway DB query (check Supabase → Performance → slow queries).

### Auth failures

**Symptoms:** users see "Invalid credentials" when credentials are correct, or login loop.

Check in this order:
1. **Recent NextAuth config change** — inspect `lib/auth.ts` history. Roll back if suspicious.
2. **`NEXTAUTH_SECRET` changed** — this invalidates all existing sessions. If intentional, communicate to users that they must log back in. If not, restore the previous secret value immediately.
3. **`NEXTAUTH_URL` mismatch** — must match the exact deployed URL (including protocol, no trailing slash).
4. **Supabase connection** — DB unreachable means NextAuth can't look up users. Check Supabase status.
5. **Upstash rate limit** — a user hitting auth repeatedly will be blocked. To unblock a specific user, delete their rate-limit key in the Upstash console (keys are prefixed `ratelimit:auth:<identifier>`).
6. **Bcrypt salt round mismatch** — if someone changed rounds, existing hashes still verify (bcrypt stores the rounds in the hash), but new hashes will use the new rounds. Not a cause of failure, but noted for awareness.

### Booking failures

**Symptoms:** patient clicks Confirm, sees error, or gets "Slot no longer available" repeatedly.

1. **Race condition / unique index conflict** — expected behaviour if two patients raced for the same slot. The loser should see a "pick another time" message. If everyone is seeing it, the unique partial index on `(dentist_id, appointment_date, start_time)` may be missing. Check:
   ```sql
   SELECT indexname FROM pg_indexes WHERE tablename = 'appointments';
   ```
2. **Validation error** — check Sentry for the specific Zod error. Often a missing service duration or a dentist with no availability rows.
3. **Email verification blocking** — by design, unverified patients cannot book. Confirm this is the actual cause before treating it as a bug.
4. **Timezone bug** — slots are generated in clinic TZ (Australia/Sydney) but stored in UTC. If slots look off by an hour, check whether a recent change bypassed the conversion helpers in `lib/slots.ts`.

Slot generation is pure and unit-tested. If the tests pass and production misbehaves, the bug is almost certainly at the edges: input parsing or output rendering.

### Reminders not firing

Reminders run via **Vercel Cron** hitting `/api/cron/reminders` every hour.

1. **Vercel → Cron Jobs** — is the job listed, enabled, and running? Check the last execution timestamp and status.
2. **Execution logs** — Vercel → the cron invocation → Logs. Look for auth failures (wrong `CRON_SECRET`), DB timeouts, or provider errors.
3. **`CRON_SECRET` mismatch** — if the endpoint returns 401, the env var in Vercel doesn't match what's in the `Authorization` header of the cron config.
4. **No matching appointments** — query:
   ```sql
   SELECT id, appointment_date, start_time, reminder_sent, status
   FROM appointments
   WHERE reminder_sent = false
     AND status IN ('PENDING', 'CONFIRMED')
     AND appointment_date >= CURRENT_DATE
   ORDER BY appointment_date, start_time
   LIMIT 20;
   ```
   If there are rows due in the 23–25h window and `reminder_sent` is still false, the job is not processing them.
5. **Provider outage** — Twilio or Resend down. Email should still send even if WhatsApp fails (that's the spec); if both are failing, look for an exception before either send.

**Manual trigger** (for testing after a fix):
```bash
curl -X POST https://<app-url>/api/cron/reminders \
  -H "Authorization: Bearer $CRON_SECRET"
```
The endpoint is idempotent — re-running it will not double-send because `reminder_sent = true` is set transactionally.

### WhatsApp delivery issues

1. **Twilio console → Messaging → Logs** — find the message. Status tells you where it failed.
2. **Common failure reasons:**
   - `63016` — recipient hasn't opted in to the WhatsApp sandbox (dev/staging only).
   - `63003` — phone number not registered on WhatsApp.
   - `21211` — invalid phone format. Numbers must be E.164 (`+61412345678`, not `0412 345 678`).
3. **Sandbox vs production sender** — `TWILIO_WHATSAPP_FROM` differs. The sandbox number only delivers to opted-in testers. Production requires an approved Twilio WhatsApp Business sender.
4. **Template approval** — production WhatsApp messages must use a pre-approved template. If Twilio returns "template not approved" errors, resubmit in the Twilio console.

### Email delivery issues

1. **Resend dashboard → Logs** — find the send, see delivery status.
2. **Bounces / spam** — check the domain's DKIM, SPF, DMARC records. Resend → Domains shows the verification state. Any red status is the first thing to fix.
3. **`EMAIL_FROM` address** — must be on a verified domain in Resend.
4. **Rate limits** — Resend free tier has a sending cap (check current limits in their dashboard). If reminders batch-send to a lot of patients, the job may hit the cap. Solution: add a small delay between sends, or upgrade the plan.

### Database issues

**Slow queries:**
1. Supabase → Database → Query Performance. Look for queries with high mean time.
2. Usual suspect: a page that loads "all appointments" without pagination, or a missing index.
3. Required indexes (confirm they exist):
   - `appointments (dentist_id, appointment_date)` — for slot generation.
   - `appointments (patient_id)` — for patient history.
   - Unique partial: `appointments (dentist_id, appointment_date, start_time) WHERE status IN ('PENDING', 'CONFIRMED')`.

**Connection errors:**
- Supabase free tier has a low connection limit. Prisma's connection pool sits in front of it. If you see `too many connections`, you likely have a Prisma client being instantiated per request instead of using the singleton in `lib/prisma.ts`.

**Locks / long-running queries:**
```sql
SELECT pid, now() - query_start AS duration, state, query
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY duration DESC;
```
Kill with `SELECT pg_cancel_backend(<pid>);` (graceful) or `pg_terminate_backend(<pid>)` (force). Understand the query before killing it.

### Excel export issues

1. **Download returns empty file or error** — check the Vercel function log for `/api/admin/export`. Common cause: function timeout on very large date ranges. Vercel's default function timeout is 10s on the free plan.
2. **Wrong data** — re-check filters in the UI. The endpoint is thin; if the DB has the right rows, the export will too.
3. **Unicode / name rendering** — `xlsx` library handles this, but if a patient name appears mangled, check the source in the DB — it may have been stored wrong at registration.

---

## Routine Operations

### Weekly checks (Mondays)

- Sentry: triage new issues from the week.
- Vercel Cron: spot-check the last 7 days of `/api/cron/reminders` runs — all should be 2xx.
- Supabase: check DB size against the plan limit.
- Resend / Twilio: check usage against plan limits.

### Monthly checks

- Review Sentry error trends.
- Rotate any secrets flagged as aging (see [Secret rotation](#secret-rotation)).
- Test a restore from backup to a scratch Supabase project.
- Review user roles — any former staff still marked `ADMIN`?

### Adding a new dentist (production data)

Preferred: use the admin UI (`/admin/dentists`). Only use SQL if the UI is broken.

### Blocking a dentist's dates (e.g. holiday)

Preferred: admin UI (`/admin/dentists` → dentist → blocked dates).

### Offboarding a patient (GDPR-style request)

Patients can't be deleted (spec: "Cannot delete patients (data integrity)"). For a genuine erasure request:
1. Anonymize the `users` row: set `email`, `first_name`, `last_name`, `phone` to placeholder values. Null the `password_hash`.
2. Keep `id` and appointment history intact for the clinic's medical records obligations.
3. Log the request and action in a ticket for audit trail.
4. Check local law — Australia's Privacy Act 1988 and the relevant state health records law will govern actual retention obligations. Do not invent policy; escalate to the clinic operations lead.

### Secret rotation

Rotate quarterly or immediately on suspected compromise:

1. **`NEXTAUTH_SECRET`** — generate new with `openssl rand -base64 32`. Rotating invalidates all sessions; users will re-login. Communicate first if possible.
2. **`CRON_SECRET`** — generate new, update in Vercel env, update in `vercel.json` cron header, redeploy.
3. **`RESEND_API_KEY`** — create new key in Resend dashboard, update env, redeploy, then revoke old key.
4. **`TWILIO_AUTH_TOKEN`** — rotate in Twilio console, update env, redeploy. Twilio supports dual-token overlap briefly — use it to avoid a gap.
5. **`DATABASE_URL`** — rotate the DB password in Supabase, update env, redeploy. Expect a brief connection error window.

Never rotate more than one at a time. Never rotate Friday afternoon.

### Local dev environment reset

```bash
pnpm install
cp .env.example .env           # fill in values from 1Password
pnpm db:reset                  # reset + reseed — dev DB only
pnpm dev
```

Login as `admin@demo.com / Admin123!` from the seed.

---

## Monitoring

- **Sentry** — error tracking. Alerts configured on: new issue type, error rate spike, performance regression on booking endpoint.
- **Vercel Analytics** — traffic, response times.
- **Supabase dashboard** — DB health, connection count, slow queries.
- **Upstash dashboard** — rate-limit key activity.
- **Resend dashboard** — email delivery rate, bounce rate.
- **Twilio console** — WhatsApp delivery rate, failures.

Add new alerts when you catch an incident that monitoring missed. Update this runbook in the same PR.

---

## Post-Incident

For every SEV-1 or SEV-2:

1. Write a post-mortem within 48 hours. Template in `docs/post-mortems/TEMPLATE.md`.
2. Cover: timeline, user impact, root cause, what went well, what didn't, action items with owners and dates.
3. Blameless: focus on systems and process, not people.
4. Link the post-mortem from this runbook's relevant section if it changes the procedure.

---

## Change Log

Record substantive changes to this runbook. Small fixes don't need an entry.

| Date | Change | Author |
|---|---|---|
| _add entries here_ | | |
