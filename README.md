# Embark

**Self-hosted employee onboarding for HR teams and new hires.** Built by Team AURA.

HR adds a new hire, Embark emails them a one-time link to create their login, and their onboarding checklist is ready before day one. Tasks go to the right people (HR, the new hire, their reporting manager). Documents are uploaded, reviewed and tracked until they expire. Each department's HR works in its own private space.

Everything runs on your own servers. There are no paid services or third-party SaaS.

---

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Setting up your company](#setting-up-your-company)
- [How logins work](#how-logins-work)
- [HR spaces and visibility](#hr-spaces-and-visibility)
- [Background worker](#background-worker)
- [Demo data](#demo-data)
- [Testing](#testing)
- [Deploying to production](#deploying-to-production)
- [Security](#security)
- [Commands](#commands)
- [Project structure](#project-structure)

---

## Features

**For HR**
- **Employees.** Add, edit, archive and restore people. A department, designation, role and reporting manager can be set for each person. You can resend a welcome email that hasn't been used yet.
- **Onboarding.** Start onboarding from a template and preview the tasks before starting. Follow each new hire's progress, and add or reassign tasks by hand.
- **Templates.** Build reusable checklists from steps and tasks. Each task sets who does it (HR, the new hire, or the reporting manager), when it's due relative to the joining date, its priority, and any document it needs.
- **Tasks.** Filter by status, priority, owner or overdue. Tasks can be blocked or skipped with a note, and every change is kept in a history.
- **Documents.** Review queue with approve, or reject with a reason. Previews for PDFs and images. Expiry tracking.
- **Reports.** Onboarding started vs completed over time, progress by department, task breakdowns, and employee counts. Exports to CSV.
- **Settings (HR Admin).**
  - **Roles:** a permission grid per role.
  - **Users:** turn logins on or off, sign someone out everywhere.
  - **Departments:** departments, designations and each department's HR.
  - **Document types:** accepted file types, size limits, required, expiry.
  - **Audit log:** a full history of changes.

**For new hires and managers**
- A personal dashboard: what's next, a week agenda, onboarding progress, and who their HR and reporting manager are.
- **My tasks**, grouped as overdue, today, this week and later.
- Document uploads with a live progress bar.
- A view of teammates' onboarding progress. Their tasks and documents stay private.

**Everywhere**
- An in-app notification inbox. Important events also go by email: assignments, reminders, rejections and expiry warnings.
- Layouts that work on phones.
- **Light and dark themes.** You can follow your device's setting or choose one.
- Every text colour meets the WCAG AA contrast standard in both themes, and the reports chart uses colours that colour-blind users can tell apart.

---

## Tech stack

| Area | Technology |
|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript |
| UI | Tailwind CSS 4, shadcn/ui (Radix), Recharts, Plus Jakarta Sans |
| Data | PostgreSQL 16, Prisma 7 |
| Auth | Better Auth (email + password, invite-only) |
| Files | RustFS (S3-compatible storage) |
| Jobs and email | Redis 7, BullMQ, Nodemailer (Mailpit in development) |
| Validation | Zod, React Hook Form |
| Testing | Vitest (integration), Playwright (end-to-end) |
| Deployment | Docker Compose, Caddy (automatic HTTPS) |

---

## Getting started

**You need:** Node.js 22, Docker, and Google Chrome (only for the end-to-end tests).

```bash
cp .env.example .env          # then replace every change-me value
docker compose up -d          # Postgres, Redis, RustFS storage, Mailpit
npm install
npx prisma migrate dev        # create the tables
npx prisma db seed            # roles, permissions, departments, document types, default template, storage bucket
npm run dev                   # http://localhost:3000
```

In a second terminal, start the worker for emails and reminders:

```bash
npm run worker
```

Generate `BETTER_AUTH_SECRET` with `openssl rand -base64 32`.

| Service | Address |
|---|---|
| App | http://localhost:3000 |
| Health check | http://localhost:3000/api/health |
| Mailpit (development inbox) | http://localhost:8025 |
| RustFS console | http://localhost:9001 |
| PostgreSQL | `localhost:5434` |
| Redis | `localhost:6379` |

All infrastructure ports listen on `127.0.0.1` only.

To look around straight away, load the [demo data](#demo-data).

---

## Setting up your company

Embark has no built-in admin account. The **database admin** adds the HR people once, and from then on HR does everything in the app.

**1. Add the HR people** (directly in Postgres):

```sql
INSERT INTO employees ("employeeCode", "firstName", "lastName", email, "joiningDate", "roleKey") VALUES
  ('EMB-0001', 'Priya', 'Sharma', 'priya.sharma@company.com', CURRENT_DATE, 'HR_ADMIN'),
  ('EMB-0002', 'Arun',  'Kumar',  'arun.kumar@company.com',   CURRENT_DATE, 'HR_MANAGER');
```

`id`, `status` and the timestamps are filled in automatically. `roleKey` is one of `HR_ADMIN`, `HR_MANAGER`, `REPORTING_MANAGER` or `EMPLOYEE`.

**2. Give each department its HR:**

```sql
UPDATE departments
SET "hrEmployeeId" = (SELECT id FROM employees WHERE email = 'arun.kumar@company.com')
WHERE name = 'Engineering';
```

Once a department has people in it, change its HR with the command below instead of SQL, because the command also moves their open HR tasks. HR Admins can do the same thing in **Settings → Departments**.

```bash
npm run department:set-hr -- "Engineering" new.hr@company.com
npm run department:set-hr -- "Engineering" none      # remove the department's HR
```

**3. Send them their sign-up links.** Nobody in the app can invite the first HR people yet, so the database admin does it:

```bash
npm run invite -- priya.sharma@company.com
npm run invite -- priya.sharma@company.com --print-link   # also print the link, e.g. before email is set up
```

They get the normal welcome email with a one-time link (the worker must be running to send it). Once the first HR Admin has signed in, everyone else is added through the app.

---

## How logins work

Nobody can sign themselves up. Every login starts with HR:

1. HR adds the person in the app and picks their role. HR Managers can only give the Employee and Reporting Manager roles.
2. Embark emails them a **one-time sign-up link**, valid for 7 days. **No password is ever emailed.**
3. They choose a password and are signed in with the role HR chose. Because the link came to their inbox, no separate email check is needed.

HR can resend the welcome email, which cancels the old link.

HR can start onboarding before the person has signed up. Their tasks wait and are handed over automatically when they do.

Without a valid link, nobody can create a login. That includes strangers, and anyone who simply knows a new hire's email address. Public sign-up is switched off in the auth API as well.

---

## HR spaces and visibility

Each department has one HR, who owns everyone in it. **HR spaces never overlap.** A person's space is everyone who shares their HR.

- **HR Managers** see and manage only the people in their own departments, plus anyone they added to a department with no HR.
- When someone is added to a department, **that department's HR becomes their HR** automatically.
- If a person or task isn't in your space, Embark shows "not found", even if you type its address directly.

| | HR Admin | HR Manager | Reporting Manager | Employee |
|---|---|---|---|---|
| Which people | Whole company | Their space | Their space | Their space |
| Colleagues' name, designation, department, onboarding progress | ✅ | ✅ | ✅ | ✅ |
| Colleagues' contact details, tasks, documents, onboarding detail | ✅ | ✅ | ❌ | ❌ |
| Direct reports' profile, onboarding and tasks | — | — | ✅ (no documents or login details) | — |
| Own profile, onboarding, tasks and documents | ✅ | ✅ | ✅ | ✅ |
| Other HR spaces | ✅ | ❌ | ❌ | ❌ |

These rules live in `lib/auth/rbac.ts`. `employeeScope` covers full access and `spaceScope` covers the progress-only colleague view. Both the integration tests and the end-to-end tests check them.

---

## Background worker

`npm run worker` (the `worker` service in production) handles everything that happens outside a page request:

| Job | When | What it does |
|---|---|---|
| Send emails | As soon as one is queued | Sends welcome, password-reset and notification emails. Retries for about an hour if the mail server is down |
| Notification emails | Every minute | Emails the notifications that should go by email. Routine updates such as "task completed" stay in the app |
| Daily jobs | `DAILY_JOBS_CRON` (default 08:00) in `NEXT_PUBLIC_APP_TIMEZONE` (default Asia/Kolkata) | Sends due-tomorrow reminders, overdue reminders (on day 1, then weekly), a daily summary for each HR, and document expiry warnings at 30, 7 and 0 days. Also marks lapsed documents expired |

Every reminder is de-duplicated, so running a job again never sends anything twice. To run the daily jobs now, use `npm run jobs:daily`. If Redis is down, the app sends emails directly instead of queueing them.

---

## Demo data

For development only. Both commands refuse to run in production.

```bash
npm run demo:seed     # a small demo company
npm run demo:clean    # removes it, including uploaded files and queued emails
```

All demo logins use the password `Demo-Pass-2026`:

| Email | Role |
|---|---|
| `priya@demo.embark.local` | HR Admin (owns Engineering) |
| `rahul@demo.embark.local` | Reporting Manager |
| `asha@demo.embark.local` | New hire, partway through onboarding |
| `dev@demo.embark.local` | New hire, onboarding finished |

Everything the demo creates uses the `@demo.embark.local` domain, so cleaning it never touches real people.

---

## Testing

Both test suites need `docker compose up -d`. Each one uses its own database (created automatically), so neither touches your development data.

### Integration tests

```bash
npm test
```

99 Vitest tests run against an `embark_test` database. They cover:

- invite-only registration
- HR space isolation and visibility rules
- onboarding, tasks and documents
- reports and settings
- the background jobs

### End-to-end tests

```bash
npm run test:e2e                     # builds the app, then runs the browser tests
E2E_SKIP_BUILD=1 npm run test:e2e    # reuses the last build
```

Playwright drives your installed Google Chrome against a production build on port 3100, with a desktop pass and a phone-sized pass. Each run starts fresh with:

- its own `embark_e2e` database, storage bucket and Redis database
- two HR spaces of test people, all `@e2e.embark.test`
- the real email worker, so welcome emails arrive in Mailpit

The tests cover:

- **The full journey:** HR adds a new hire → welcome email → creating a login → onboarding starts → a task is finished → a document is uploaded and approved.
- **Isolation:** HR spaces never see each other's people, tasks or documents.
- **Roles:** what each role can open inside a space.
- **Sign-up:** nobody can sign themselves up.
- **Layout and themes:** phone layouts, and the light/dark theme switch.

If a test fails, run `npx playwright show-report` for screenshots and traces.

---

## Deploying to production

```bash
docker compose --profile prod up -d --build
```

This command:
- **Runs migrations and the seed.** The seed creates roles, permissions, reference data and the storage bucket, and is safe to run again.
- **Starts the app.** It runs as the small standalone Next.js server, as a non-root user.
- **Starts the worker.**
- **Starts Caddy in front for automatic HTTPS.**

Before deploying:
1. Set your domain in `Caddyfile`, replacing `localhost`.
2. In `.env`, set real SMTP settings (Mailpit is for development only), set `APP_URL` and `BETTER_AUTH_URL` to your `https://` address, and use strong passwords.
3. Only Caddy is exposed. The database, Redis and storage stay on the private Docker network.

Back up the `postgres_data` and `storage_data` Docker volumes. They hold all records and uploaded files.

---

## Security

- **Logins:** invite-only, with one-time links that expire. Accounts that are turned off are blocked when they next sign in.
- **Brute-force limits:** sign-in allows 5 attempts per minute per IP, and password-reset emails are limited to 3 per 5 minutes. These limits apply in production and assume a single app instance.
- **Permission checks:** every page, server action and API route checks permissions and the person's space on the server. The sidebar only hides links; it doesn't grant access.
- **Uploads:** files are checked by their actual content, not their extension. PDF, PNG, JPG and DOCX are allowed, up to 10 MB, and each document type can narrow that further.
- **Stored files:** files sit in private storage and are only served through the app after a permission check. Downloads are recorded in the audit log.
- **Audit log:** important changes are recorded with who made them and when. Entries can't be edited.
- **Security headers:** strict security headers are set on every response, and document previews are sandboxed.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the app in development |
| `npm run worker` | Start the background worker |
| `npm run build` / `npm start` | Production build / start |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript checks |
| `npm test` · `npm run test:e2e` | Integration tests · end-to-end tests |
| `npm run db:migrate` · `npm run db:deploy` | Create a migration (development) · apply migrations |
| `npm run db:seed` · `npm run db:studio` | Seed reference data · browse the database |
| `npm run invite -- <email>` | Send a sign-up link to someone added in Postgres (e.g. the first HR Admin) |
| `npm run department:set-hr` | Change a department's HR |
| `npm run jobs:daily` | Run the daily reminder and expiry jobs now |
| `npm run demo:seed` · `npm run demo:clean` | Add or remove demo data |

---

## Project structure

```
app/            Routes: (auth) sign-in pages, (dashboard) app pages, api/ routes
components/     Layout (sidebar, top bar, theme), shared building blocks, ui/ (shadcn)
features/       One folder per area (employees, onboarding, tasks, documents, reports,
                notifications, settings, auth), each with its actions, queries, service,
                schemas and components
lib/            Auth and permissions, database, email, queue and worker, storage, jobs, utilities
hooks/          Client hooks (URL filters, debounce, unread count)
prisma/         Schema, migrations, seed
scripts/        Command-line tools (invites, department HR, daily jobs, demo data)
tests/          Integration (Vitest) and end-to-end (Playwright) tests
```

---

Made by **Team AURA**.
