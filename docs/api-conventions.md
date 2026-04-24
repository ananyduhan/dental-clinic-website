# API Conventions

> Conventions for all API route handlers and Server Actions in this project. Read `CLAUDE.md` first — this doc is the detailed reference for the architecture rules summarised there.

---

## When to use what

| Use case | Use |
|---|---|
| User-initiated mutation from a form or button | **Server Action** |
| Fetching data for a page | **Server Component** (direct DB call via Prisma) |
| Webhook receiver (Twilio, Resend) | **API Route Handler** |
| Cron endpoint (Vercel Cron) | **API Route Handler** |
| File download (Excel export) | **API Route Handler** |
| Anything called by an external system | **API Route Handler** |
| Client-side polling or streaming | **API Route Handler** |

**Default to Server Actions for mutations.** Only reach for a route handler when one of the reasons above applies.

---

## Route structure

### Public (no auth)
```
/api/auth/*                 NextAuth handlers
/api/webhooks/twilio        WhatsApp delivery status
/api/webhooks/resend        Email delivery status
```

### Patient (auth required, role = PATIENT)
```
/api/appointments           GET own, POST new, PATCH /:id
/api/availability           GET available slots
/api/dentists               GET (public list of active dentists)
/api/services               GET (public list of active services)
/api/patient/profile        GET, PATCH own profile
```

### Admin (auth required, role = ADMIN or DENTIST)
```
/api/admin/appointments     GET all, PATCH /:id
/api/admin/dentists         GET, POST, PATCH /:id, DELETE /:id
/api/admin/services         GET, POST, PATCH /:id
/api/admin/availability     GET/PUT /:dentistId
/api/admin/blocked-dates    POST, DELETE /:id
/api/admin/patients         GET
/api/admin/export           GET (returns .xlsx)
```

### Cron (auth via `CRON_SECRET`)
```
/api/cron/reminders         hourly
```

---

## Handler shape

Every route handler follows the same four-step pattern: **parse → validate → call lib → respond.** No business logic in the handler itself.

```ts
// app/api/appointments/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { createAppointmentSchema } from '@/lib/validators/appointment'
import { createAppointment } from '@/lib/appointments'
import { handleApiError } from '@/lib/errors'

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole('PATIENT')
    const body = await req.json()
    const input = createAppointmentSchema.parse(body)

    const appointment = await createAppointment({
      patientId: session.user.id,
      ...input,
    })

    return NextResponse.json({ data: appointment }, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
}
```

Route handlers stay under ~30 lines. If yours is longer, the business logic belongs in `lib/`.

---

## Server Action shape

```ts
// lib/actions/appointments.ts
'use server'

import { requireRole } from '@/lib/auth'
import { createAppointmentSchema } from '@/lib/validators/appointment'
import { createAppointment } from '@/lib/appointments'
import { revalidatePath } from 'next/cache'

export async function bookAppointment(input: unknown) {
  const session = await requireRole('PATIENT')
  const data = createAppointmentSchema.parse(input)

  const appointment = await createAppointment({
    patientId: session.user.id,
    ...data,
  })

  revalidatePath('/appointments')
  return { success: true, appointment }
}
```

Server Actions return plain objects — **never** throw raw errors to the client. Use the same typed errors from `lib/errors.ts` and let a wrapper translate them to a safe response shape.

---

## Response shape

Every JSON response is one of two shapes. No exceptions.

### Success
```json
{
  "data": { ... }
}
```

For lists with pagination:
```json
{
  "data": [ ... ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 134
  }
}
```

### Error
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": { ... }
  }
}
```

`details` is optional and used mainly for field-level validation errors:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": {
      "email": "Must be a valid email address",
      "phone": "Phone number is required"
    }
  }
}
```

---

## Status codes

| Code | When |
|---|---|
| `200` | Successful GET, PATCH, PUT |
| `201` | Successful POST that created a resource |
| `204` | Successful DELETE (no body) |
| `400` | Malformed JSON, missing required fields |
| `401` | Not authenticated |
| `403` | Authenticated but not authorised (wrong role, not your resource) |
| `404` | Resource does not exist |
| `409` | Conflict — e.g. slot already booked, email already registered |
| `422` | Validation error (Zod parse failure) |
| `429` | Rate limit exceeded |
| `500` | Unhandled server error |

Use `422` for Zod failures, `400` only when the request itself is malformed (not JSON, etc.). This distinction matters for the client to decide whether to show field errors vs a generic failure.

---

## Error codes

Codes are stable strings the client can switch on. Messages are human-readable and may change.

| Code | HTTP | Thrown by |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Zod parse failures |
| `UNAUTHORIZED` | 401 | No session |
| `FORBIDDEN` | 403 | Wrong role, IDOR attempt |
| `NOT_FOUND` | 404 | `NotFoundError` from `lib/errors.ts` |
| `CONFLICT` | 409 | `ConflictError` — booking clash, duplicate email |
| `RATE_LIMITED` | 429 | Upstash rate limit |
| `EMAIL_NOT_VERIFIED` | 403 | Patient trying to book without verifying |
| `SLOT_TAKEN` | 409 | Specific conflict: slot was booked between selection and confirmation |
| `TOO_LATE_TO_CANCEL` | 409 | Cancel/reschedule within 24h window |
| `INTERNAL_ERROR` | 500 | Unhandled — never leak stack traces |

All errors flow through `handleApiError` in `lib/errors.ts`. That function is the only place that talks to Sentry for 5xx logging.

---

## Validation

### Rules
- Every handler and Server Action validates input with Zod. No exceptions.
- Schemas live in `lib/validators/`, one file per domain (`appointment.ts`, `dentist.ts`, etc.).
- Schemas are reused on the client via `react-hook-form` + `@hookform/resolvers/zod`.
- **No `any`. No unvalidated `request.json()`.**

### Example schema
```ts
// lib/validators/appointment.ts
import { z } from 'zod'

export const createAppointmentSchema = z.object({
  dentistId: z.string().uuid(),
  serviceId: z.string().uuid(),
  appointmentDate: z.string().date(),           // ISO date
  startTime: z.string().regex(/^\d{2}:\d{2}$/), // HH:mm
  notes: z.string().max(1000).optional(),
})

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>
```

### Query params
Parse `URLSearchParams` through a Zod schema too — don't trust `searchParams.get(...)`:

```ts
const querySchema = z.object({
  dentistId: z.string().uuid(),
  date: z.string().date(),
  serviceId: z.string().uuid(),
})

const params = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams))
```

---

## Authentication and authorisation

### Session check
Middleware handles the coarse-grained check for `(patient)` and `(admin)` route groups. **Middleware is not enough.** Every handler re-checks.

```ts
import { requireRole } from '@/lib/auth'

const session = await requireRole('ADMIN')       // throws UnauthorizedError or ForbiddenError
const session = await requireRole(['ADMIN', 'DENTIST'])
const session = await requireSession()            // any authenticated user
```

### IDOR prevention
Never trust URL params for ownership. Always filter by `session.user.id` in the query:

```ts
// ✅ correct
const appt = await prisma.appointment.findFirst({
  where: { id: params.id, patientId: session.user.id },
})
if (!appt) throw new NotFoundError('appointment')

// ❌ wrong — lets any patient read any appointment
const appt = await prisma.appointment.findUnique({ where: { id: params.id } })
```

### Dentist scoping
Dentists can only see their own appointments and the patients attached to them:

```ts
const appointments = await prisma.appointment.findMany({
  where: { dentistId: session.user.dentistId },
})
```

---

## Rate limiting

Use Upstash Redis via `lib/rate-limit.ts`. Apply to:

- All `/api/auth/*` endpoints — 5 attempts per 15 min per IP
- `POST /api/appointments` — 10 per hour per user
- `POST /api/auth/forgot-password` — 3 per hour per email

```ts
const { success } = await rateLimit(`auth:${ip}`, { limit: 5, window: '15m' })
if (!success) throw new RateLimitError()
```

Rate limit keys are scoped by the most specific identifier available (user ID > email > IP).

---

## Idempotency

### Appointment creation
Race conditions are prevented by:
1. A unique partial index on `(dentist_id, appointment_date, start_time)` where `status IN ('PENDING', 'CONFIRMED')`.
2. Wrapping the create in a Prisma `$transaction` that re-checks for overlaps before insert.
3. Catching the Prisma unique-constraint error and throwing `ConflictError` with code `SLOT_TAKEN`.

The client retries the flow from the slot-picker step on `SLOT_TAKEN`, not a blind retry.

### Cron reminders
`/api/cron/reminders` must be safe to run twice. `reminder_sent = true` is set in the **same transaction** as the send, so a crash mid-batch doesn't double-send.

---

## Cron endpoints

- Configured in `vercel.json`, not `node-cron`.
- Every cron handler verifies the `Authorization: Bearer ${CRON_SECRET}` header before doing anything.
- Returns `401` on missing/wrong secret — no further information.
- Logs the run to Sentry as a breadcrumb, not an error, unless something fails.

```ts
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }
  // ...
}
```

---

## Webhooks

- Verify signatures before doing anything (`X-Twilio-Signature`, Resend webhook signature).
- Respond `200` as fast as possible, then do heavy work. If processing takes >5s, offload to a background job.
- Idempotency: webhook providers retry. Track the external event ID and skip duplicates.
- Never trust webhook payload fields for user IDs — look up by the external ID.

---

## File downloads

Excel export returns a binary body with the right headers:

```ts
return new NextResponse(buffer, {
  status: 200,
  headers: {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="appointments-${from}-to-${to}.xlsx"`,
    'Cache-Control': 'no-store',
  },
})
```

Filename is always safe — generate it from validated input, never interpolate raw query strings.

---

## Dates and times

- **Store everything as UTC** in the database.
- Accept ISO 8601 strings at the API boundary.
- Convert to/from the clinic timezone (`Australia/Sydney`) at the edges using `date-fns-tz`.
- `appointmentDate` is a `date` (no time). `startTime` / `endTime` are `HH:mm` strings. The combination is converted to a UTC `Date` in `lib/slots.ts`.
- Never send a raw `Date.toString()` to the client — always ISO strings.

---

## Pagination

Default `pageSize` is `20`, max is `100`.

```
GET /api/admin/appointments?page=2&pageSize=50&status=CONFIRMED&from=2026-04-01&to=2026-04-30
```

Response:
```json
{
  "data": [ ... ],
  "meta": { "page": 2, "pageSize": 50, "total": 134 }
}
```

For lists that can grow unbounded (appointment history), use cursor pagination instead of offset:

```
GET /api/appointments?cursor=<id>&limit=20
```

---

## Filtering and sorting

- Filter params are **flat and explicit**: `?status=CONFIRMED&dentistId=...&from=...&to=...`. No nested JSON in query strings.
- All filter params go through Zod validation.
- Sort via `?sort=appointmentDate&order=desc`. Allow only a documented whitelist of sortable fields per endpoint.

---

## Caching

- Public GETs (`/api/dentists`, `/api/services`) — `Cache-Control: public, max-age=60, s-maxage=300`.
- Anything user-scoped — `Cache-Control: private, no-store`.
- Admin endpoints — `Cache-Control: no-store`.
- Use `revalidatePath` / `revalidateTag` in Server Actions after mutations. Don't rely on the client to refetch.

---

## Logging and observability

- Log 5xx errors to Sentry with request context (user ID, route, method). **Never** log request bodies — they may contain PII.
- Log auth failures (401/403) as Sentry breadcrumbs, not errors, to avoid alert noise.
- Add a request ID header (`X-Request-Id`) on every response. Generate one if the client didn't send one.
- Cron runs log start/end with the count of records processed.

---

## Security checklist for every endpoint

- [ ] Zod validation on all inputs (body, query, params).
- [ ] Session check via `requireSession` or `requireRole`.
- [ ] Role check **in the handler**, not just middleware.
- [ ] DB queries scoped by `session.user.id` where applicable (IDOR).
- [ ] Rate limit applied where relevant.
- [ ] No secrets or stack traces in error responses.
- [ ] No PII in logs.
- [ ] Webhooks verify signatures.
- [ ] Cron endpoints verify `CRON_SECRET`.
- [ ] File-download filenames are generated, not reflected from input.

---

## Quick reference: creating a new endpoint

1. Add the Zod schema in `lib/validators/<domain>.ts`.
2. Add the business logic as a pure-ish function in `lib/<domain>.ts`. Unit-test it.
3. Add the handler (Server Action or route handler per the table at the top).
4. Handler body: `requireRole → schema.parse → call lib → return { data }`.
5. Wrap in `try/catch` with `handleApiError`.
6. Add an e2e test for the happy path and one failure case.
7. Update this doc if you introduced a new error code or response pattern.
