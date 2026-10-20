# Embark

Self-hosted employee onboarding system by Team AURA.

Stack: Next.js · TypeScript · PostgreSQL 16 · Prisma · Better Auth · RustFS (S3-compatible storage) · Redis + BullMQ · Zod · Docker Compose.

## Local setup

```bash
cp .env.example .env        # then replace every change-me value
docker compose up -d        # Postgres, Redis, RustFS, Mailpit
npm install
npx prisma migrate dev      # create tables
npx prisma db seed          # roles, permissions, departments, document types, default template, storage bucket
npm run dev                 # http://localhost:3000
npm run worker              # in a second terminal: emails, reminders, expiry checks
```

| Service | Address |
|---|---|
| App | http://localhost:3000 |
| Health check | http://localhost:3000/api/health |
| PostgreSQL | `localhost:5434` |
| RustFS console | http://localhost:9001 |
| Mailpit (dev inbox) | http://localhost:8025 |

## Settings (HR Admins)

| Area | What you can do | Safety rails |
|---|---|---|
| Roles | Change what each role may do | HR Admin always keeps everything; managing users/roles and reading the audit log stay admin-only; re-seeding never undoes your changes |
| Users | Deactivate/reactivate logins, sign someone out everywhere | Can't deactivate yourself or the last active HR Admin; archived employees come back only by restoring them |
| Departments | Add, rename, delete; manage designations; set the department's HR | Only empty departments and unused designations can be deleted |
| Document types | Add or change accepted file types, size limit, required, expiry | Types already used by uploads or templates can't be deleted |
| Audit log | See who did what and when, including system jobs | — |

## Background worker

`npm run worker` (the `worker` service in Docker) runs everything that happens outside a request:

| Job | When | What it does |
|---|---|---|
| Send emails | As queued | Delivers welcome, password-reset, and notification emails; retries for about an hour if the mail server is down |
| Notification emails | Every minute | Emails notifications that should go by email (assignments, reminders, rejections, expiry). Routine updates like "task completed" stay in-app only |
| Daily jobs | `DAILY_JOBS_CRON` (default 08:00) in `NEXT_PUBLIC_APP_TIMEZONE` (default Asia/Kolkata) | Due-tomorrow reminders; overdue reminders on day 1 and then weekly, plus a daily summary for each HR; document expiry warnings at 30, 7, and 0 days; marks lapsed documents expired; re-syncs department HR changes made with raw SQL |

Every reminder is de-duplicated, so re-running a job never sends anything twice. Run the daily jobs immediately with `npm run jobs:daily`.

If Redis is down, the app sends emails directly instead of queueing them, so nothing is lost.

## Demo data (development only)

```bash
npm run demo:seed     # a small demo company to click around in
npm run demo:clean    # removes it again (files and queued emails too)
```

Sign in as `priya@demo.embark.local` (HR Admin), `rahul@demo.embark.local` (Reporting Manager), or `asha@demo.embark.local` (new hire), all with the password `Demo-Pass-2026`. Everything uses the `@demo.embark.local` domain, so cleaning never touches real people. Both commands refuse to run in production.

## Tests

```bash
npm test    # needs `docker compose up -d`
```

Integration tests run against a separate `embark_test` database (created once with `docker compose exec postgres createdb -U embark embark_test`). They never touch the dev database.

### End-to-end tests

```bash
npm run test:e2e                     # builds the app, then runs the browser tests
E2E_SKIP_BUILD=1 npm run test:e2e    # reuses the last build
```

Playwright drives your installed Google Chrome against a production build on port 3100. The run includes a phone-sized pass. Each run starts from scratch with:

- its own `embark_e2e` database (created automatically), storage bucket and Redis database
- two HR spaces of fixture people, all `@e2e.embark.test`
- the email worker, so welcome emails arrive in Mailpit the real way

It covers:

- the full journey: HR adds a new hire, the welcome link, creating a login, starting onboarding, finishing a task, uploading and approving a document
- that HR spaces never see each other's people, tasks or documents
- what each role can open inside a space
- that nobody can sign themselves up
- phone layouts

On failure, open `npx playwright show-report` for screenshots and traces.

## How accounts are created

Nobody is seeded as a user. Every login is created on the **sign-up page** from a link only HR adding someone can produce:

1. The database admin adds the HR people directly in Postgres and assigns each department its HR (below).
2. HR adds everyone else through the HR portal and picks their role (HR Admin, HR Manager, Reporting Manager, or Employee). HR Managers can only give the Employee and Reporting Manager roles.
3. The new person gets a **welcome email** with a one-time sign-up link (valid 7 days). They choose a password and are signed in with the role HR chose. No password is ever emailed, and because the link came from their inbox, no separate verification email is needed. HR can resend the email, which cancels the old link.

HR can start someone's onboarding as soon as they're added. Tasks meant for them wait and are handed over automatically when they register.

There is no open sign-up: without a valid link, nobody can create a login — not strangers, and not someone who knows a new hire's email.

## HR spaces

Each department has one HR, who owns everyone in it. HR spaces never overlap:

- An HR Manager sees and manages only the people in their departments (plus people they added to departments with no HR).
- When an HR Manager adds someone, they can only use their own departments; with exactly one department it's filled in automatically.
- When an HR Admin adds someone to a department, that department's HR becomes their HR.
- New hires only ever see their own onboarding and tasks.

### Who can see what

A person's **space** is everyone who shares their HR (normally their department's HR).

| | HR Admin | HR Manager | Reporting Manager | Employee |
|---|---|---|---|---|
| Which people | Whole company | Their space | Their space | Their space |
| Colleagues' name, designation, department, onboarding % and status | ✅ | ✅ | ✅ | ✅ |
| Colleagues' contact details, tasks, documents, onboarding detail | ✅ | ✅ | ❌ | ❌ |
| Direct reports' profile, onboarding, and tasks | — | — | ✅ (no documents or login details) | — |
| Own profile, onboarding, tasks, and documents | ✅ | ✅ | ✅ | ✅ |
| Other spaces | ✅ | ❌ | ❌ | ❌ |

These rules live in `lib/auth/rbac.ts` (`employeeScope` for full access, `spaceScope` for the progress-only colleague view) and are pinned down by `tests/integration/visibility.test.ts`.

### Adding HR people and assigning departments (database admin)

```sql
-- 1. Add the HR people
INSERT INTO employees ("employeeCode", "firstName", "lastName", email, "joiningDate", "roleKey") VALUES
  ('EMB-0001', 'Priya', 'Sharma', 'priya.sharma@company.com', CURRENT_DATE, 'HR_ADMIN'),
  ('EMB-0002', 'Arun',  'Kumar',  'arun.kumar@company.com',   CURRENT_DATE, 'HR_MANAGER');

-- 2. Give a department its HR (fine before anyone has been added to the department)
UPDATE departments
SET "hrEmployeeId" = (SELECT id FROM employees WHERE email = 'arun.kumar@company.com')
WHERE name = 'Engineering';
```

`id`, `status`, and timestamps are filled in by the database. `roleKey` is one of `HR_ADMIN`, `HR_MANAGER`, `REPORTING_MANAGER`, `EMPLOYEE`.

To **change** a department's HR once it has people in it, use the command instead of SQL. It also moves those people's open HR tasks to the new HR:

```bash
npm run department:set-hr -- "Engineering" new.hr@company.com
npm run department:set-hr -- "Engineering" none      # remove the department's HR
```

To change someone's role after they've registered, use the HR portal (it updates both `employees."roleKey"` and `user_roles`).

## Production

```bash
docker compose --profile prod up -d --build
```

This runs database migrations and the seed (roles, permissions, reference data, storage bucket — safe to re-run), starts the app and the worker, and puts Caddy in front for HTTPS. Set your domain in `Caddyfile` and real SMTP settings in `.env` (Mailpit is for development only). Only Caddy is exposed; the database, Redis, and storage stay on the private Docker network.

Sign-in is limited to 5 attempts per minute per IP and password-reset emails to 3 per 5 minutes (production only). These limits are kept in memory, so they assume a single app instance.
