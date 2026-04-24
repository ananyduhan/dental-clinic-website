# Dental Clinic Web App — Full Project Specification

## Project Overview

A full-stack web application for a dental clinic that handles public-facing marketing, patient registration and login, appointment booking with real-time availability, an admin dashboard for clinic staff, automated WhatsApp and email reminders, and appointment data export to Excel/Google Sheets.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Next.js API Routes (or Express if preferred) |
| Database | PostgreSQL via Supabase (free tier) |
| ORM | Prisma |
| Auth | NextAuth.js (credentials + email magic link) |
| Email | Resend (free tier) |
| WhatsApp | Twilio WhatsApp Business API |
| Scheduling | node-cron (for reminder jobs) |
| Excel Export | xlsx (npm package) |
| Deployment | Vercel (frontend + API), Supabase (DB) |
| File Storage | Supabase Storage (for dentist profile photos) |

---

## Database Schema

### Users table
```
users
- id (uuid, primary key)
- email (string, unique)
- password_hash (string, nullable — null if using magic link)
- first_name (string)
- last_name (string)
- phone (string) — used for WhatsApp reminders
- role (enum: PATIENT | ADMIN | DENTIST)
- email_verified (boolean, default false)
- created_at (timestamp)
- updated_at (timestamp)
```

### Dentists table
```
dentists
- id (uuid, primary key)
- user_id (uuid, foreign key → users.id)
- bio (text)
- specialisation (string) — e.g. "General Dentistry", "Orthodontics"
- profile_photo_url (string)
- is_active (boolean, default true)
- created_at (timestamp)
```

### Availability table
```
availability
- id (uuid, primary key)
- dentist_id (uuid, foreign key → dentists.id)
- day_of_week (enum: MON | TUE | WED | THU | FRI | SAT | SUN)
- start_time (time) — e.g. "09:00"
- end_time (time) — e.g. "17:00"
- is_active (boolean, default true)
```

### Blocked dates table
```
blocked_dates
- id (uuid, primary key)
- dentist_id (uuid, foreign key → dentists.id)
- date (date) — specific date blocked (holiday, sick day, etc.)
- reason (string, nullable)
- created_at (timestamp)
```

### Appointments table
```
appointments
- id (uuid, primary key)
- patient_id (uuid, foreign key → users.id)
- dentist_id (uuid, foreign key → dentists.id)
- appointment_date (date)
- start_time (time)
- end_time (time)
- service_type (string) — e.g. "Checkup", "Cleaning", "Root Canal"
- status (enum: PENDING | CONFIRMED | CANCELLED | COMPLETED)
- notes (text, nullable) — patient notes
- admin_notes (text, nullable) — internal notes
- reminder_sent (boolean, default false)
- created_at (timestamp)
- updated_at (timestamp)
```

### Services table
```
services
- id (uuid, primary key)
- name (string) — e.g. "General Checkup"
- duration_minutes (integer) — e.g. 30, 60
- description (string)
- is_active (boolean, default true)
```

---

## Pages and Routes

### Public pages (no login required)

#### `/` — Landing page
- Hero section with clinic name, tagline, and "Book Appointment" CTA button
- About the clinic section (mission, values, opening hours)
- Meet the dentists section — card grid showing each active dentist with photo, name, specialisation, short bio
- Services section — list of services offered with icons and duration
- Opening hours table
- Contact section — address, phone, email, embedded Google Maps iframe
- Footer with links and social media

#### `/login` — Patient login page
- Email + password form
- "Forgot password" link
- Link to register page
- Form validation with error messages

#### `/register` — Patient registration page
- Fields: first name, last name, email, phone number, password, confirm password
- Email verification flow — sends verification email on signup
- Redirect to login after successful registration

#### `/forgot-password` — Password reset
- Email input, sends reset link
- `/reset-password?token=...` — new password form

---

### Patient pages (login required, role: PATIENT)

#### `/dashboard` — Patient dashboard
- Welcome message with patient name
- Upcoming appointments list (next 3–5)
- Quick "Book New Appointment" button
- Link to full appointment history

#### `/book` — Book appointment (multi-step form)
**Step 1 — Select service**
- Grid of available services with name, duration, description
- Patient selects one

**Step 2 — Select dentist**
- List of active dentists
- Option to select "No preference" (system assigns available dentist)

**Step 3 — Select date and time**
- Calendar date picker (only shows future dates)
- Disables dates where selected dentist has no availability or is blocked
- Once date is selected, show available time slots as buttons
- Time slots generated based on dentist availability minus existing appointments minus service duration
- Clash prevention: if a slot is already booked, it does not appear

**Step 4 — Confirm booking**
- Summary of selected service, dentist, date, time
- Notes field (optional — e.g. "I have tooth sensitivity")
- Confirm button

**Step 5 — Booking confirmed**
- Success message
- Appointment summary card
- Confirmation email sent automatically
- WhatsApp reminder scheduled for 24 hours before appointment

#### `/appointments` — Appointment history
- Table of all appointments (upcoming + past)
- Status badges (Pending, Confirmed, Cancelled, Completed)
- Cancel button on upcoming appointments (only if >24hrs away)
- Reschedule button (opens booking flow with pre-filled dentist)

#### `/profile` — Patient profile
- View and edit: first name, last name, phone number
- Change password form
- Cannot change email (requires admin)

---

### Admin pages (login required, role: ADMIN or DENTIST)

#### `/admin` — Admin dashboard
- Summary cards: today's appointments, total patients, pending confirmations, cancellations this week
- Today's appointment list (all dentists) sorted by time
- Quick action buttons: Add blocked date, Export appointments

#### `/admin/appointments` — All appointments
- Filterable table: by dentist, by date range, by status
- Columns: patient name, dentist, service, date, time, status, notes
- Click row to expand and see full details
- Admin can change appointment status (Pending → Confirmed, mark as Completed)
- Admin can add internal notes
- Cancel button with confirmation dialog

#### `/admin/dentists` — Manage dentists
- List of all dentists with active/inactive toggle
- Add new dentist button (creates user + dentist record)
- Edit dentist: bio, specialisation, photo upload
- Per-dentist availability management:
  - Weekly schedule — toggle days on/off, set start/end time per day
  - Add blocked dates (specific dates unavailable — holidays, sick leave)

#### `/admin/services` — Manage services
- List of services with name, duration, active status
- Add / edit / deactivate services
- Duration setting (used for slot generation)

#### `/admin/patients` — Patient list
- Searchable table of all registered patients
- View patient profile and appointment history
- Cannot delete patients (data integrity)

#### `/admin/export` — Export appointments
- Date range picker
- Optional filter by dentist
- Export as .xlsx button — downloads Excel file
- Columns in export: Patient Name, Patient Phone, Dentist, Service, Date, Time, Status, Notes

---

## Core Logic

### Slot generation algorithm
When a patient selects a dentist and date:
1. Look up dentist availability for that day of week
2. Generate all possible slots from start_time to end_time in increments of service duration_minutes
3. Fetch all existing appointments for that dentist on that date with status PENDING or CONFIRMED
4. Remove any slots that overlap with existing appointments
5. Remove any slots in the past (if today's date)
6. Return remaining slots as available

### Clash prevention
- Slots are only shown if they are fully free for the entire service duration
- On booking submission, re-check availability server-side before saving (race condition protection)
- If slot is taken between user selecting and confirming, return an error and ask them to pick again

### Reminder system (node-cron)
- Cron job runs every hour
- Queries appointments where:
  - appointment_date + start_time is between 23 and 25 hours from now
  - reminder_sent = false
  - status = CONFIRMED or PENDING
- For each matched appointment:
  - Send WhatsApp message via Twilio to patient phone
  - Send reminder email via Resend
  - Set reminder_sent = true

### Email triggers
| Event | Email sent to |
|---|---|
| Patient registers | Patient — verify email |
| Appointment booked | Patient — booking confirmation |
| Appointment confirmed by admin | Patient — confirmation update |
| Appointment cancelled | Patient — cancellation notice |
| 24hrs before appointment | Patient — reminder |

---

## API Routes

### Auth
- `POST /api/auth/register` — create account
- `POST /api/auth/login` — login
- `POST /api/auth/logout` — logout
- `POST /api/auth/forgot-password` — send reset email
- `POST /api/auth/reset-password` — update password with token
- `GET /api/auth/verify-email?token=...` — verify email

### Appointments
- `GET /api/appointments` — get current patient's appointments
- `POST /api/appointments` — create new appointment
- `PATCH /api/appointments/:id` — cancel or reschedule (patient)
- `GET /api/admin/appointments` — get all appointments (admin)
- `PATCH /api/admin/appointments/:id` — update status, notes (admin)

### Availability
- `GET /api/availability?dentistId=&date=&serviceId=` — get available slots
- `GET /api/admin/availability/:dentistId` — get dentist weekly schedule
- `PUT /api/admin/availability/:dentistId` — update weekly schedule
- `POST /api/admin/blocked-dates` — add blocked date
- `DELETE /api/admin/blocked-dates/:id` — remove blocked date

### Dentists
- `GET /api/dentists` — get all active dentists (public)
- `GET /api/admin/dentists` — get all dentists (admin)
- `POST /api/admin/dentists` — add dentist
- `PATCH /api/admin/dentists/:id` — update dentist
- `DELETE /api/admin/dentists/:id` — deactivate dentist

### Services
- `GET /api/services` — get all active services (public)
- `POST /api/admin/services` — add service
- `PATCH /api/admin/services/:id` — update service

### Export
- `GET /api/admin/export?from=&to=&dentistId=` — returns .xlsx file download

### Patients
- `GET /api/admin/patients` — get all patients
- `GET /api/patient/profile` — get own profile
- `PATCH /api/patient/profile` — update own profile

---

## Environment Variables Required

```env
# Database
DATABASE_URL=

# Auth
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# Email (Resend)
RESEND_API_KEY=
EMAIL_FROM=noreply@yourclinic.com

# WhatsApp (Twilio)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Folder Structure

```
/
├── app/
│   ├── (public)/
│   │   ├── page.tsx                  ← landing page
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── forgot-password/page.tsx
│   ├── (patient)/
│   │   ├── dashboard/page.tsx
│   │   ├── book/page.tsx
│   │   ├── appointments/page.tsx
│   │   └── profile/page.tsx
│   ├── (admin)/
│   │   ├── admin/page.tsx
│   │   ├── admin/appointments/page.tsx
│   │   ├── admin/dentists/page.tsx
│   │   ├── admin/services/page.tsx
│   │   ├── admin/patients/page.tsx
│   │   └── admin/export/page.tsx
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── appointments/route.ts
│       ├── availability/route.ts
│       ├── dentists/route.ts
│       ├── services/route.ts
│       └── admin/
│           ├── appointments/route.ts
│           ├── dentists/route.ts
│           ├── export/route.ts
│           └── patients/route.ts
├── components/
│   ├── ui/                           ← shadcn/ui components
│   ├── landing/                      ← landing page sections
│   ├── booking/                      ← multi-step booking flow
│   ├── admin/                        ← admin dashboard components
│   └── shared/                       ← navbar, footer, etc.
├── lib/
│   ├── prisma.ts                     ← Prisma client
│   ├── auth.ts                       ← NextAuth config
│   ├── email.ts                      ← Resend email helpers
│   ├── whatsapp.ts                   ← Twilio WhatsApp helpers
│   ├── slots.ts                      ← slot generation logic
│   └── export.ts                     ← Excel export logic
├── prisma/
│   └── schema.prisma                 ← full DB schema
├── jobs/
│   └── reminder.ts                   ← cron job for reminders
└── types/
    └── index.ts                      ← shared TypeScript types
```

---

## Seed Data (for demo/testing)

Create a seed script that generates:
- 1 admin user (admin@demo.com / password: Admin123!)
- 3 dentists with different specialisations and weekly availability
- 5 services (Checkup 30min, Cleaning 45min, Filling 60min, Root Canal 90min, Whitening 60min)
- 10 test patients
- 20 sample appointments spread across next 2 weeks with mixed statuses

---

## Security Requirements

- All admin routes protected by role check middleware
- All patient routes protected by session check
- Passwords hashed with bcrypt (salt rounds: 12)
- SQL injection protection via Prisma ORM (parameterised queries)
- Rate limiting on auth endpoints (max 5 attempts per 15 min)
- Input validation with Zod on all API routes
- CSRF protection via NextAuth built-in
- Phone numbers validated before sending WhatsApp messages
- Email verified before patient can book appointments

---

## Nice-to-Have (Phase 2 — after MVP)

- Google Calendar sync for dentists
- SMS fallback if WhatsApp fails
- Online payment deposit on booking (Stripe)
- Dentist mobile app (React Native)
- Patient reviews and ratings
- Automated invoice generation as PDF
- Waitlist for fully booked slots
