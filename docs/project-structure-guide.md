# Project Structure Guide (Beginner-Friendly)

> A complete explanation of every file and folder in this project, how they connect, and where to make changes.

---

## The Big Picture

Think of this dental clinic website like a **real building**. The building has:
- A **front door** (the public website — anyone can see it)
- A **patient waiting room** (pages only logged-in patients can see)
- A **staff-only back office** (admin/dentist dashboard)
- A **basement** with plumbing and wiring (the database, business logic, emails, etc.)

All of these live in one codebase.

---

## The Root (Top-Level) Files

These are **configuration files** — they tell the project how to behave. You rarely edit them day-to-day.

| File | What it does | When you touch it |
|---|---|---|
| `package.json` | Lists every library your project uses (like a shopping list). Also defines shortcut commands like `pnpm dev` | When you install a new library |
| `pnpm-lock.yaml` | Auto-generated exact record of which library versions are installed. **Never edit by hand.** | Never — pnpm writes it |
| `tsconfig.json` | Tells TypeScript how strict to be about checking your code | Almost never |
| `tailwind.config.ts` | Tells Tailwind CSS which colors, fonts, and spacing your project uses | When you add a new design token (color, font) |
| `next.config.mjs` | Settings for the Next.js framework itself | When you need a special feature (image domains, redirects) |
| `postcss.config.mjs` | Makes Tailwind's CSS work in the build. **Don't touch.** | Never |
| `.eslintrc.json` | Rules for the code-quality checker (catches common mistakes) | When you want to allow/forbid a coding pattern |
| `.gitignore` | Tells git which files to NOT track (secrets, build output) | When you add a new file that shouldn't go to GitHub |
| `.env.example` | A **template** showing what secret environment variables you need. The real `.env` file is never committed to git | When you add a new API key or secret |
| `.npmrc` | Low-level package manager settings. **Don't touch.** | Never |
| `components.json` | Configuration for shadcn/ui (the pre-built component library). **Don't touch.** | Never |
| `vitest.config.ts` | Settings for the automated test runner | When you change how tests are organized |
| `CLAUDE.md` | Instructions specifically for Claude Code about this project | When you want to change how Claude works on this project |
| `README.md` | Human-readable introduction to the project | When you want to explain the project to someone new |
| `dental-clinic-spec.md` | The full feature specification — what the app should do | Reference when planning features |

---

## `app/` — The Pages (What Users See)

This is the most important folder. In Next.js, **the folder structure directly controls the website's URLs**.

- A folder named `login` → the URL `/login`
- A folder named `book` → the URL `/book`
- The file inside the folder named `page.tsx` → the actual page at that URL

### The three route groups (folders with parentheses)

The parentheses `()` are special — they **group pages together without affecting the URL**. They're used here to separate who can access what.

```
app/
  (public)/      ← Anyone can visit these pages (no login needed)
  (patient)/     ← Only logged-in patients can visit
  (admin)/       ← Only admins and dentists can visit
```

#### `app/(public)/` — Public pages

| File | URL it creates | What it is |
|---|---|---|
| `login/page.tsx` | `/login` | The login form |
| `register/page.tsx` | `/register` | The sign-up form |
| `forgot-password/page.tsx` | `/forgot-password` | "Forgot password" form |
| `reset-password/page.tsx` | `/reset-password` | The page linked in the password-reset email |
| `layout.tsx` | — | Wraps all public pages with a shared navbar/footer |

#### `app/(patient)/` — Patient dashboard pages

| File | URL it creates | What it is |
|---|---|---|
| `dashboard/page.tsx` | `/dashboard` | Patient's home screen after login |
| `book/page.tsx` | `/book` | The appointment booking flow |
| `appointments/page.tsx` | `/appointments` | List of the patient's appointments |
| `profile/page.tsx` | `/profile` | Patient's profile/settings |
| `layout.tsx` | — | Adds the patient navbar to all these pages |

#### `app/(admin)/` — Admin/dentist pages

| File | URL it creates | What it is |
|---|---|---|
| `admin/page.tsx` | `/admin` | Admin dashboard home |
| `admin/appointments/page.tsx` | `/admin/appointments` | View/manage all appointments |
| `admin/dentists/page.tsx` | `/admin/dentists` | Add/edit dentists |
| `admin/services/page.tsx` | `/admin/services` | Add/edit dental services |
| `admin/patients/page.tsx` | `/admin/patients` | View patient list |
| `admin/export/page.tsx` | `/admin/export` | Download Excel report |
| `layout.tsx` | — | Adds the admin sidebar to all these pages |

#### Special app files

| File | What it does |
|---|---|
| `app/page.tsx` | The **home page** (`/`) — the public landing/marketing page |
| `app/layout.tsx` | The **root layout** — wraps every single page in the whole app. Good place for fonts, global providers |
| `app/globals.css` | Global CSS — defines color tokens, fonts, base styles used everywhere |
| `app/fonts/` | The actual font files (Geist font) used by the app |
| `app/favicon.ico` | The little icon shown in the browser tab |

#### `app/api/` — The Backend (API routes)

These are not pages — they are **server endpoints** that receive and respond to data requests. Think of them like phone lines the frontend calls to do things.

| File | URL | What it does |
|---|---|---|
| `api/auth/[...nextauth]/route.ts` | `/api/auth/*` | Handles login/logout (managed by NextAuth) |
| `api/appointments/route.ts` | `/api/appointments` | Create/read appointments (patients) |
| `api/availability/route.ts` | `/api/availability` | Check which time slots are open |
| `api/dentists/route.ts` | `/api/dentists` | Get list of dentists |
| `api/services/route.ts` | `/api/services` | Get list of services |
| `api/admin/appointments/route.ts` | `/api/admin/appointments` | Admin: manage all appointments |
| `api/admin/dentists/route.ts` | `/api/admin/dentists` | Admin: add/edit/delete dentists |
| `api/admin/patients/route.ts` | `/api/admin/patients` | Admin: view patients |
| `api/admin/export/route.ts` | `/api/admin/export` | Admin: generate Excel file |
| `api/cron/route.ts` | `/api/cron` | Automated reminders — runs on a timer, not by users |

---

## `components/` — Reusable Building Blocks

Pages are made up of components. A component is a **reusable piece of UI** — like a LEGO brick. You build complex pages by combining components.

### `components/ui/` — Basic building blocks

These come from **shadcn/ui**, a pre-built component library. They are low-level, unstyled-by-default pieces.

| File | What it is |
|---|---|
| `button.tsx` | A styled button |
| `input.tsx` | A text input field |
| `card.tsx` | A white box/card container |
| `dialog.tsx` | A popup modal window |
| `select.tsx` | A dropdown selector |
| `label.tsx` | A form field label |
| `textarea.tsx` | A multi-line text input |
| `badge.tsx` | A small colored tag (e.g. "Confirmed", "Pending") |
| `avatar.tsx` | A circular profile picture |
| `tabs.tsx` | Tab navigation (like browser tabs) |
| `toast.tsx` / `toaster.tsx` | The small popup notification (e.g. "Appointment booked!") |
| `skeleton.tsx` | A grey loading placeholder while content loads |
| `popover.tsx` | A small floating popup (used in the date picker) |
| `separator.tsx` | A horizontal dividing line |
| `dropdown-menu.tsx` | A menu that appears when you click something |

> **Rule:** Don't edit these directly. If you need a custom version, copy the file and modify the copy.

### `components/landing/` — Home page sections

Each file is one visual section of the marketing/home page (`/`).

| File | What it shows |
|---|---|
| `hero.tsx` | The big top section ("Book your appointment today") |
| `about-section.tsx` | About the clinic |
| `services-section.tsx` | List of dental services |
| `dentists-section.tsx` | Meet the dentists |
| `contact-section.tsx` | Contact form / clinic info |

> **This is the best place to start editing** if you want to change how the home page looks.

### `components/booking/` — The appointment booking flow

| File | What it does |
|---|---|
| `booking-form.tsx` | The multi-step form: choose service → choose dentist → pick date/time → confirm |
| `cancel-appointment-button.tsx` | The "Cancel appointment" button with confirmation dialog |

### `components/admin/` — Admin dashboard pieces

| File | What it shows |
|---|---|
| `appointments-table.tsx` | Table of all appointments for admins |
| `patients-table.tsx` | Table of all patients |
| `dentists-manager.tsx` | Add/edit/delete dentists |
| `services-manager.tsx` | Add/edit/delete services |
| `export-form.tsx` | Form to pick date range and download Excel |

### `components/shared/` — Used everywhere

| File | What it is |
|---|---|
| `navbar.tsx` | The top navigation bar (public site) |
| `footer.tsx` | The bottom footer |
| `mobile-nav.tsx` | The hamburger menu on mobile (public site) |
| `patient-mobile-nav.tsx` | Mobile nav for the patient dashboard |
| `profile-form.tsx` | The form to edit your name, phone, etc. |

---

## `lib/` — The Engine Room (Business Logic)

This folder contains the **brain** of the app — functions that do actual work. No visual UI here.

| File | What it does | Analogy |
|---|---|---|
| `prisma.ts` | Creates one shared connection to the database | The one phone line to the database |
| `auth.ts` | Configures login/logout, session management, role checking | The security guard |
| `email.ts` | Functions for sending emails (confirmation, reminders, password reset) via Resend | The mail department |
| `whatsapp.ts` | Functions for sending WhatsApp reminders via Twilio | The WhatsApp messaging department |
| `slots.ts` | Pure logic: given a dentist's schedule, calculate which time slots are available | The scheduler's brain |
| `export.ts` | Logic to generate an Excel file from appointment data | The Excel report writer |
| `errors.ts` | Defines custom error types (`NotFoundError`, `UnauthorizedError`, etc.) | The error vocabulary |
| `rate-limit.ts` | Prevents abuse — limits how many requests one user can make per minute | The bouncer |
| `utils.ts` | Small helper functions used everywhere (like combining CSS class names) | Miscellaneous tools |

### `lib/validators/` — Input validation rules

Every piece of data the user submits gets checked here before it touches the database.

| File | What it validates |
|---|---|
| `auth.ts` | Email format, password strength for login/register |
| `appointment.ts` | Appointment booking data (date, dentist ID, service ID) |
| `dentist.ts` | Dentist profile data (name, specialization, etc.) |
| `service.ts` | Service data (name, price, duration) |
| `profile.ts` | Patient profile updates (phone, name) |

---

## `prisma/` — The Database Blueprint

| File | What it does |
|---|---|
| `schema.prisma` | **The database schema** — defines every table (User, Appointment, Dentist, Service) and their columns. The single source of truth for your data structure. |
| `seed.ts` | A script to fill the database with sample data for development (fake dentists, services, etc.) |

> If you want to understand the data structure of this app, **start here**. `schema.prisma` tells you exactly what information is stored.

---

## `types/` — Shared TypeScript Type Definitions

| File | What it does |
|---|---|
| `index.ts` | Custom TypeScript types shared across the app (e.g. what an `Appointment` object looks like in code) |
| `next-auth.d.ts` | Extends NextAuth's built-in types to include custom fields like `role` and `id` on the session |

---

## `hooks/` — Custom React Hooks

| File | What it does |
|---|---|
| `use-toast.ts` | Logic for showing/hiding toast notifications. Used by `toaster.tsx`. |

---

## `tests/` — Automated Tests

| File | What it tests |
|---|---|
| `tests/unit/slots.test.ts` | Tests the slot-generation logic in `lib/slots.ts` to make sure it calculates available times correctly |
| `tests/e2e/` | End-to-end browser tests (currently empty — Playwright tests go here) |

---

## `docs/` — Documentation

These are long-form specs. Read them to understand how a specific part of the system is designed.

| File | What it covers |
|---|---|
| `architecture.md` | How all the parts fit together |
| `design-system.md` | Colors, fonts, spacing rules |
| `database.md` | Database schema details and conventions |
| `api-conventions.md` | How API responses are shaped |
| `booking-flow.md` | How the booking algorithm works |
| `security.md` | Auth, authorization, rate limiting |
| `runbook.md` | What to do when things break in production |

---

## How Everything Connects (The Data Flow)

Here is what happens when a patient books an appointment:

```
Patient fills out form
       ↓
components/booking/booking-form.tsx   (collects the input)
       ↓
lib/validators/appointment.ts         (validates the data — is the date real? is dentist ID valid?)
       ↓
app/api/appointments/route.ts         (the API receives the request)
       ↓
lib/slots.ts                          (checks the slot is actually available)
       ↓
lib/prisma.ts → PostgreSQL database   (saves the appointment)
       ↓
lib/email.ts                          (sends confirmation email via Resend)
       ↓
Response goes back to browser         (patient sees "Booked!")
```

---

## Where to Change What

| If you want to change... | Edit this file |
|---|---|
| Text/content on the home page | `components/landing/hero.tsx`, `about-section.tsx`, etc. |
| Colors / fonts | `app/globals.css` and `tailwind.config.ts` |
| The booking form steps | `components/booking/booking-form.tsx` |
| The admin dashboard tables | `components/admin/appointments-table.tsx`, etc. |
| The navbar links | `components/shared/navbar.tsx` |
| Email templates | `lib/email.ts` |
| WhatsApp messages | `lib/whatsapp.ts` |
| Database tables (add a column) | `prisma/schema.prisma` (then run `pnpm db:migrate`) |
| Which pages require login | `app/(patient)/layout.tsx` or `app/(admin)/layout.tsx` |
| Validation rules for a form | `lib/validators/[relevant-file].ts` |

---

## Suggested Learning Order (Beginner Path)

Start from what's **most visual and immediate**, then go deeper:

1. **`app/page.tsx`** + **`components/landing/`** — The home page. This is plain React/JSX. You can see changes instantly with `pnpm dev`.
2. **`app/globals.css`** + **`tailwind.config.ts`** — Learn how colors and spacing are defined.
3. **`components/ui/`** — Read one file (like `button.tsx`) to understand how a basic component is structured.
4. **`prisma/schema.prisma`** — Understand what data exists (users, appointments, dentists, services).
5. **`lib/validators/appointment.ts`** — See how Zod validates data. Short and readable.
6. **`app/api/appointments/route.ts`** — See how the backend receives a request, validates it, and calls the database.
7. **`lib/slots.ts`** — More advanced: pure logic functions. There are tests for them too.
8. **`lib/auth.ts`** — Once you understand the rest, this ties together login, sessions, and roles.

> The golden rule: **always run `pnpm dev` and open `localhost:3000` in your browser** while you edit. The browser is the best feedback loop.
