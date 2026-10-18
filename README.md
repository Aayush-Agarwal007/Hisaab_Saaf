# Hisaab Saaf

*Aapka kaam, aapka hisaab.*

A first progressive web app that gives a part-time domestic worker and each household she works for one shared, agreed record of **leave days** and **advances**, so the 1st-of-the-month argument ("how many days did you miss?", "how much advance did I already give you?") has a number nobody disputes.

The worker owns the account. Every entry she logs is confirmed by the employer through a single-use link delivered over WhatsApp. The employer needs no account and no install.

> **Status:** 30-day solo build and 10-user pilot. This is a pilot-stage project with hand-provisioned accounts, not a public product.

---

## Contents

- [How it works](#how-it-works)
- [Features](#features)
- [What this is not](#what-this-is-not)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Provisioning a worker](#provisioning-a-worker)
- [Scripts](#scripts)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security and privacy](#security-and-privacy)
- [Operations](#operations)
- [Documentation](#documentation)
- [Pilot success criteria](#pilot-success-criteria)

---

## How it works

1. **Worker logs in** with her mobile number and a 6-digit PIN.
2. She **adds a household** (label, employer's WhatsApp number, paid leave per month, weekly off, start date).
3. She logs a **leave day** or an **advance** against that household.
4. The app builds a `wa.me` link with a prefilled Hindi message containing a **single-use confirmation link**. She taps Send in WhatsApp.
5. The **employer opens the link** (no login) and taps **"Sahi hai"** (correct) or **"Galat hai"** (incorrect).
6. The worker's screen shows the entry as **pending**, **confirmed** or **contested**.
7. On the 1st, both sides can open the same **monthly summary** for that household.

```
Worker (PWA) --> Supabase (RLS)            Employer (any browser)
     |                                            ^
     |  wa.me link with /l/<token>                |
     +--------> WhatsApp ----------------------> Vercel (Next.js route, service role)
```

## Features

**In the pilot (P0)**

| Area            | What it does                                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| Login           | Mobile number + 6-digit PIN via Supabase Auth, lockout copy after 5 failures, re-PIN after 15 minutes idle |
| Consent         | One-time Hindi consent screen before any data entry                                                        |
| Households      | Add, edit and archive up to six households per worker                                                      |
| Leave           | One-tap "Aaj chhutti", date editable up to 7 days back, one entry per day per household                    |
| Advances        | Integer rupees (1 to 50,000), optional note up to 80 characters                                            |
| Confirmation    | Single-use, 7-day token delivered via `wa.me`; employer confirms or contests without an account          |
| Status          | Pending / confirmed / contested on every entry, shown with icon and text                                   |
| Monthly summary | Leave used vs quota, advances confirmed and pending, month picker, shareable read-only link                |
| Privacy         | Self-service account and data deletion; minimal event logging with no free text                            |

**Planned after the pilot (P1)**: payment and bonus entries, employer read-only history, print stylesheet, English UI toggle, voice entry, JSON export. These are built only if pilot evidence asks for them.

## What this is not

Hisaab Saaf deliberately avoids becoming a worker-rating or verification platform, a placement marketplace, an employer-side attendance tool, a payments app, or a wage-law calculator. There are no ratings, comments about workers, in-app payments, push notifications, photo uploads, Aadhaar or address collection, or AI features. Records are informal memory aids, not legal documents, and the app says so.

## Tech stack

| Layer                      | Choice                                                      |
| -------------------------- | ----------------------------------------------------------- |
| Frontend and server routes | Next.js (App Router, TypeScript)                            |
| Styling                    | Tailwind CSS                                                |
| Forms and validation       | react-hook-form + Zod (schemas shared by client and server) |
| Database and auth          | Supabase (Postgres, Auth, Row Level Security)               |
| Messaging                  | `wa.me` deep links (no paid API)                          |
| Hosting                    | Vercel (Hobby) + Supabase (Free)                            |
| Tests                      | Vitest, Testing Library, Playwright, axe                    |
| CI                         | GitHub Actions                                              |
| Uptime                     | UptimeRobot or cron-job.org pinging `/api/health`         |

Total infrastructure cost for the pilot: zero.

## Project structure

```
hisaab-saaf/
  app/
    (worker)/             login, consent, home, engagements/[id]/..., settings/
    l/[token]/            employer confirm/contest page (public)
    s/[token]/            shared monthly summary (public)
    api/
      health/             uptime + DB ping
      entries/[id]/link/  issue a confirmation token + wa.me URL
      engagements/[id]/summary-link/
      me/delete/          delete account and data
  components/             Button, Card, StatusChip, PinInput, BottomBar, IdleGuard
  lib/
    supabase/             client.ts, server.ts, admin.ts (server only)
    schemas.ts            Zod schemas
    tokens.ts             generate + hash tokens
    whatsapp.ts           build wa.me URLs
    summary.ts            pure summary functions
    i18n/                 hi.json, en.json, t.ts
  supabase/
    migrations/           0001_init, 0002_rls, 0003_admin_delete
    seed.sql
    tests/                RLS tests
  scripts/provision.ts    create worker accounts (admin only)
  tests/                  unit, integration, e2e
  docs/                   PRD, SRS, UX, ARCHITECTURE, RUNBOOK, ...
```

## Getting started

### Prerequisites

- Node.js 20 LTS and npm
- Git
- Docker Desktop (for the local Supabase stack)
- Supabase CLI

If you can't run Docker, point `.env.local` at a free hosted Supabase "dev" project instead.

### Setup

```bash
git clone git@github.com:<you>/hisaab-saaf.git
cd hisaab-saaf
npm ci

# Local database (applies migrations and seed data)
supabase start
supabase db reset

# Environment
cp .env.example .env.local
# Fill in the values printed by `supabase status`

# Typed database client
supabase gen types typescript --local > lib/database.types.ts

# Run the app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Supabase Studio is at [http://localhost:54323](http://localhost:54323).

To test on a real phone, open the app over your local network IP. The confirmation page and the PIN keypad behave differently on real Android browsers than in desktop device mode.

## Environment variables

| Name                              | Where                 | Secret        | Notes                                                       |
| --------------------------------- | --------------------- | ------------- | ----------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | client + server       | no            |                                                             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server       | no            | Protected by RLS                                            |
| `SUPABASE_SERVICE_ROLE_KEY`     | **server only** | **yes** | Never ship to the browser, never paste into chats or issues |
| `NEXT_PUBLIC_APP_URL`           | client + server       | no            | Used to build confirmation links                            |
| `SUPPORT_WHATSAPP`              | server                | no            | Admin number behind the "Madad" (help) link                 |
| `TOKEN_TTL_HOURS`               | server                | no            | Default `168` (7 days)                                    |

Secrets live only in Vercel environment variables and the gitignored `.env.local`. `lib/supabase/admin.ts` must never be imported from a client component.

## Provisioning a worker

Public sign-up is disabled. Accounts are created by the admin.

```bash
npx tsx scripts/provision.ts
# Prompts for: mobile number, display name, 6-digit PIN
```

The script creates a Supabase Auth user with a synthetic email (`91<phone>@u.hisaabsaaf.app`), using the PIN as the password, and inserts the matching `profiles` row. Weak PINs such as `000000`, `123456` and `111111` are rejected.

To reset a forgotten PIN, verify the person by calling their registered number, then reset it from the Supabase dashboard (Authentication > Users).

## Scripts

| Command                      | Purpose                                                      |
| ---------------------------- | ------------------------------------------------------------ |
| `npm run dev`              | Start the dev server                                         |
| `npm run build`            | Production build                                             |
| `npm run lint`             | ESLint                                                       |
| `npm run typecheck`        | TypeScript check                                             |
| `npm run test`             | Unit tests (Vitest)                                          |
| `npm run test:rls`         | Row Level Security tests against local Supabase              |
| `npm run test:integration` | Route and policy tests (needs `supabase start`)            |
| `npx playwright test`      | End-to-end tests, including a mobile viewport and axe checks |

## Testing

- **Unit:** schemas, token generation and hashing, `wa.me` message builder, summary math (including the 23:30 IST date boundary), auth email mapping.
- **RLS and integration:** a two-user isolation matrix, token states (valid, used, expired, unknown), link ownership, account-deletion cascade.
- **End to end:** login, consent, add household, log leave, issue link, confirm in a second browser context, advance and summary, idle re-PIN.
- **Manual:** two real Android devices (Chrome and Samsung Internet), Slow 4G, offline save, PWA install.

Targets: at least 80% coverage on `lib/`, 50 or more unit tests, 20 or more integration tests, and zero axe violations.

## Deployment

1. Create a Supabase project (region: Mumbai) and run `supabase link --project-ref <ref>`.
2. Push the schema: `supabase db push`.
3. In Supabase Auth settings: disable new sign-ups, set minimum password length to 6, set JWT expiry to 3600 seconds.
4. Import the repo into Vercel and set the environment variables for both Production and Preview. Mark the service role key as sensitive.
5. Open a pull request to get a preview URL and run the smoke checks against it.
6. Merge to `main` for the production deploy and point the uptime monitor at the production `/api/health`.

Post-deploy checks:

```bash
curl -sI https://<prod>/api/health | grep -E "HTTP|strict-transport"   # 200 + HSTS
curl -s  https://<prod>/api/health                                     # {"ok":true,"db":"up"}
```

**Free-tier notes:** a Supabase free project pauses after 7 days without activity (the uptime ping prevents this); Vercel Hobby is for non-commercial use, which fits a pilot.

## Security and privacy

- **Row Level Security on every table.** Workers can only read and write their own data. They cannot change an entry's status; only the server route can, after a valid employer response.
- **Employer actions run server-side** with the service role. Tokens are 32 random bytes, stored as SHA-256 hashes, single-use, and expire after 7 days (summary links after 30).
- **Minimal data:** worker phone and name, household label, employer phone, quota, dates, amounts, and an optional short note. The employer page never shows the worker's phone or the note.
- **No sensitive data in logs.** Log lines use user UUIDs only; never phone numbers or notes.
- **Headers:** CSP, `X-Frame-Options: DENY`, strict `Referrer-Policy`, HSTS.
- **Consent and deletion:** a consent screen on first login and self-service deletion that removes all rows and the auth user. Event rows are anonymised.
- **Retention:** pilot data is reviewed at Day 60 and then deleted or re-consented.

Report security issues privately to the maintainer rather than opening a public issue.

## Operations

- **Backups:** daily `supabase db dump -f backups/$(date +%F).sql`, encrypted with `gpg -c`, kept for 14 days on two devices. Restore into a fresh project with `psql < dump`.
- **Monitoring:** uptime ping on `/api/health` every 5 minutes; weekly run of `docs/METRICS.sql`.
- **Rollback:** promote the previous deployment in Vercel. Migrations are forward-only, with reverse SQL documented in each file's header.
- **Admin runbook:** provisioning, PIN reset, user deletion, metrics export and incident response are documented in `docs/RUNBOOK.md`.

## Documentation

| File                                      | Contents                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------ |
| `docs/PRD.md`                           | Scope, priorities, assumptions                                                 |
| `docs/SRS.md`                           | Functional and non-functional requirements with IDs                            |
| `docs/UX.md`                            | Screens, flows, states, Hindi copy                                             |
| `docs/ARCHITECTURE.md`                  | Stack, schema, API, auth and token flows                                       |
| `docs/DECISIONS.md`                     | Architecture decisions (synthetic-email auth, `wa.me`, no employer accounts) |
| `docs/SECURITY.md`                      | Security checklist with evidence                                               |
| `docs/RUNBOOK.md`                       | Deploy, backup, restore, rollback, support operations                          |
| `docs/PILOT.md`, `docs/VALIDATION.md` | Pilot roster, interviews, results                                              |
| `docs/METRICS.sql`                      | Queries for the five pilot metrics                                             |

## Pilot success criteria

The pilot targets ten worker and household pairs. Continue if, after the first monthly statement:

- At least 40% of entries are created by workers themselves.
- At least 60% of entries are confirmed by employers within 48 hours.
- At least 6 of 10 pairs say the month-end conversation was easier.
- At least 5 of 10 workers are still logging without being prompted.
- There are no privacy incidents and no worker reports harm from the record.

If confirmations are low but workers keep logging, fall back to a worker-only ledger with a shareable summary. If workers don't log without prompting, or any worker reports harm, stop, delete the pilot data and write up the findings.

## Disclaimer

Records in Hisaab Saaf are informal memory aids for the people involved. They are not legal documents, and the app does not calculate minimum wages or legal claims.

## License

To be decided by the maintainer.
