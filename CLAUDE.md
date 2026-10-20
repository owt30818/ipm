# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IP Address Management (IPAM) SaaS application with mobile-first responsive design. Features IP allocation, CSV bulk processing, audit logging, and role-based access control.

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Auth:** Supabase Auth
- **UI:** Tailwind CSS + Shadcn/ui
- **Bot Protection:** Cloudflare Turnstile
- **CSV Processing:** Papaparse
- **Database:** PostgreSQL (via Supabase)

## Build & Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Run development server (localhost:3000)
npm run build        # Build for production
npm run lint         # Run ESLint
```

`next.config.ts` sets `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds`, so a green `npm run build` does not mean the types are clean; check with `npx tsc --noEmit`.

### Supabase CLI

```bash
npx supabase start                    # Start local Supabase
npx supabase db reset                 # Reset DB and apply migrations
npx supabase migration new <name>     # Create new migration
npx supabase gen types typescript --local > lib/types/database.ts  # Regenerate types
```

### Docker

```bash
docker compose -f docker-compose.dev.yml up   # Dev with hot reload + local PostgreSQL
docker compose up --build                     # Production build
```

## Environment Setup

Copy `.env.example` to `.env.local` and configure:
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` - Supabase project credentials
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for admin user creation)
- `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` - Cloudflare Turnstile keys

All of these are read at runtime via `lib/env.ts` (the Docker image contains no config).
The root layout injects the public ones into the browser as `window.__ENV`.
The legacy `NEXT_PUBLIC_*` names still work as a fallback for local dev.

To get `SUPABASE_SERVICE_ROLE_KEY` for local development:
```bash
npx supabase status  # Look for "Secret" key
```

## Deployment & Versioning

- A push to `main` runs `.github/workflows/docker.yml`, which builds and pushes `ghcr.io/owt30818/ipm:latest` (and `:<sha>`). Production is a TrueNAS app that pulls this image, behind a Cloudflare Tunnel (`cloudflared`). Its YAML is `truenas-compose.yml` (gitignored, holds the runtime env).
- Nothing applies migrations. Run new `supabase/migrations/*.sql` by hand on the Supabase project, and before deploying an image that needs them.
- The version on `/about` and in the sidebar is `package.json` major.minor plus the commit count (`BUILD_NUMBER` in CI), so edit `package.json` only for a major/minor bump.
- Legacy, superseded by the GHCR flow: `deploy.sh`, `build-push.sh` and `docker-compose.yml` (Docker Hub `owt30818/ipam-app`, `NEXT_PUBLIC_*` build args), `ipm-saas.service`.
- DB backups are not part of this repo. A separate stack on the home server (`~/ipam-db-backup`) runs a daily `pg_dump -Fc` of `public` + `auth` with `--no-privileges` and 14-day retention, so grants are not in the dumps: restore data into a schema built from the migrations (incl. 013), see the comments in its compose file. In-app backup variants live on the `csv-backup` branch; do not add them to main unless asked.

## Architecture

### Folder Structure

```
app/
  (auth)/          # Login page (public) - signup removed for security
  (main)/          # Protected pages: dashboard, ip-list, allocate, settings, about
                   # (its layout redirects to /login without a session)
    dashboard/     # Per-subnet stats page, plus the IP list components that ip-list/ reuses
                   # (table, mobile cards, search filters, saved searches, export button)
  actions/         # Server Actions
    allocate-ips.ts, get-next-available-ip.ts
    bulk-update-ips.ts, bulk-delete-ips.ts
    export-ips.ts            # CSV export (any logged-in user)
    create-user.ts           # Admin: create new users
    delete-user.ts           # Admin: delete a user (never yourself)
    admin-update-password.ts # Admin: reset another user's password
    update-password.ts       # User: change own password
  api/             # API routes: audit-logs, ip-addresses/[id] (GET/PATCH/DELETE),
                   # users/[id]/role, auth/verify-turnstile
  auth/callback/   # Supabase auth callback
components/
  auth/            # Login form with Turnstile
  layout/          # Header (links to settings), Sidebar, MobileNav
  ip/              # IP detail dialog, audit log list, copy button
  ui/              # Shadcn/ui primitives, ErrorNotice
  pagination-control.tsx   # Pagination + page-size select (10/20/30/50/100, default 50)
lib/
  supabase/
    client.ts      # Browser client (use in Client Components)
    server.ts      # Server client (use in Server Components/Actions)
    admin.ts       # Admin client (use for user management, bypasses RLS)
  auth/session.ts  # getSessionProfile()
  types/
    database.ts    # Supabase generated types
  csv-import.ts, ip-sort.ts, saved-searches.ts, roles.ts, errors.ts, env.ts, build-info.ts
supabase/migrations/   # 001-013
```

### Supabase Client Usage

- **Server Components / Server Actions:** `import { createClient } from "@/lib/supabase/server"`
- **Client Components:** `import { createClient } from "@/lib/supabase/client"`
- **Admin Operations (user creation):** `import { createAdminClient } from "@/lib/supabase/admin"`

> ⚠️ Admin client bypasses RLS. Only use for admin-specific operations like user creation.

### Server Actions Pattern

Server Actions are in `app/actions/`. They use `"use server"` directive and handle auth internally:
```typescript
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
```

### Database RPC Functions

- `allocate_contiguous_ips(p_subnet_id, p_quantity, p_description, p_user_id, p_status, p_allocated_to)` - Allocates N contiguous available IPs with row-level locking (admin/sub_admin only, max 1024)
- `get_next_available_ip(p_subnet_id)` - First free host IP (skips `*.0` / `*.255`), computed in the DB
- `get_subnet_stats()` - Per-subnet capacity/status counts for the dashboard
- `search_ip_addresses(..., p_sort)` - IP list search (SECURITY INVOKER, RLS applies). `p_sort`: `ip_asc` (default), `issued_desc`, `issued_asc`; issued time = `allocated_at`, or `created_at` when null (migration 012, options in `lib/ip-sort.ts`). The list, its search filters and the CSV export all use it, so they always show the same order

RPCs are executable by `authenticated` only (never `anon`). Migrations 009/010 enforce this; keep `REVOKE ... FROM PUBLIC, anon` in any new function.

Since 2026-10-30 Supabase no longer grants Data API access to new `public` tables automatically. A migration that creates a table must `GRANT` in the same file (`authenticated` only what RLS expects, nothing to `anon`, `service_role` all). Migration 013 does this for the four existing tables so a rebuilt schema (`supabase db reset`, new project, preview branch) keeps working.

### DB triggers (migration 010)

- `ip_addresses`: an IP must lie inside its subnet (checked on insert and when `ip_address`/`subnet_id` change)
- `ip_addresses`: every insert/update/delete writes `audit_logs` automatically (`auth.uid()`); do not insert audit rows from app code, clients have no INSERT rights on `audit_logs`
- `subnets`: CIDRs must not overlap (exclusion constraint)

### Database Schema

| Table | Key Columns |
|-------|-------------|
| profiles | id (FK auth.users), email, role (admin/sub_admin/user) |
| subnets | cidr (CIDR type), name, created_by |
| ip_addresses | subnet_id, ip_address (INET), status (available/allocated/reserved/deprecated), allocated_to |
| audit_logs | ip_address_id, user_id, action_type, old_value (JSONB), new_value (JSONB) |

Row Level Security (RLS) is enabled. Use `get_my_role()` function for role checks in policies.

### Roles and permissions

Rules live in `lib/roles.ts` and mirror the RLS policies (the database stays the real enforcement):

| Action | admin | sub_admin | user |
|--------|:-----:|:---------:|:----:|
| View IPs, subnets, dashboard | ✓ | ✓ | ✓ |
| Export the IP list to CSV | ✓ | ✓ | ✓ |
| Register / edit / allocate IPs, register / edit subnets (`canManage`) | ✓ | ✓ | |
| Delete IPs and subnets (`canDelete`) | ✓ | | |

- `getSessionProfile()` (`lib/auth/session.ts`) returns the user + role once per request; the main layout passes `role` to Sidebar/Header, pages pass `canEdit`/`canDelete` to the IP list components.
- Server actions and API routes check the role first and return a Korean message; RLS-filtered writes do not raise errors, so they also verify the affected row count.

### Error messages

Never show `error.message` from Supabase/Postgres directly. Use `toKoreanError(error)` from `lib/errors.ts`; it maps SQLSTATE codes, constraint names, our own SQL exceptions (migrations 009/010), Supabase Auth codes and network failures, and falls back to a generic Korean message. Messages already in Korean pass through unchanged.

### CSV import and export

- Import rules live in `lib/csv-import.ts` (pure functions), the UI in `app/(main)/allocate/csv-upload.tsx`. Every row is classified before anything is written: invalid IP (leading zeros are rejected), unknown status, in-file duplicate, outside the chosen subnet, or already registered (checked in chunks of 200 against the DB). Only clean rows are selectable; inserts run in chunks of 500 with `upsert ... ignoreDuplicates` and report the real inserted count. Limits: 5MB / 10,000 rows. Korean status labels and EUC-KR files (Excel "CSV") are accepted.
- Export (`app/actions/export-ips.ts`) calls the same `search_ip_addresses` RPC as the list (all filters, paged by the rows actually returned), prefixes cells starting with `= + - @` with `'` against spreadsheet formula injection, and prints dates in KST.
- Radix `Checkbox` inside a `<form>` clicks a hidden input whenever `checked` changes; a row-level `onClick` must not receive that click (wrap the checkbox cell with `onClick={(e) => e.stopPropagation()}`), otherwise selection toggles itself in an endless loop.
- Pages that cannot load their data show `ErrorNotice` (`components/ui/error-notice.tsx`) with the Korean reason instead of empty/zero values.

### Responsive Layout

- **Desktop:** Fixed left sidebar (`hidden md:block`)
- **Mobile:** Hamburger menu → Sheet/Drawer (`block md:hidden`)

### Key Routes

| Route | Purpose |
|-------|---------|
| `/login` | Login page with Turnstile protection |
| `/dashboard` | Per-subnet capacity overview (totals cards + table with available/allocated/reserved/unregistered and usage rate) |
| `/ip-list` | IP search (status/subnet/description/IP), sort, saved searches, bulk status change/delete, CSV export, IP detail dialog with change history |
| `/allocate` | admin/sub_admin only. Tabs: single allocation (one IP with the next free IP prefilled, or "auto" N contiguous IPs, UI max 256), CSV upload, subnet management |
| `/settings` | Profile, user management (admin), audit log viewer |
| `/about` | App version/build date/commit and installed package versions (from `next.config.ts` build metadata) |

### User Management (Settings Page)

**Profile Tab (all users):**
- View account info (email, role, join date)
- Change password via dialog

**User Management Tab (admin only; actions check the role again server-side):**
- View all users with role badges
- Add new users (sub_admin/user, password min 6) via dialog
- Change user roles via dropdown (not your own role)
- Reset another user's password, delete a user (not yourself)

**Audit Log Tab (admin/sub_admin):**
- View system change history (badges: 생성/수정/삭제/할당/해제), 50 rows at a time
- The IP detail dialog has a per-IP "변경 이력" tab fed by the same `/api/audit-logs`

## UI Patterns

- **Mobile details:** Bottom Sheet (not new page) for IP details + audit log
- **Data tables:** Desktop uses `<Table>`, mobile uses card-based list
- **CSV upload:** Drag & drop on desktop, file picker button on mobile
- **Auth forms:** Include Cloudflare Turnstile widget
- **Dialogs:** Used for password change and user creation (inline JSX, not function components to avoid re-render issues)
- **Header:** User email links to `/settings` page
- **Saved searches (IP list):** "자주 쓰는 검색" chips under the search filters (`app/(main)/dashboard/saved-searches.tsx`, logic in `lib/saved-searches.ts`). They store the URL filter params (status/subnet/description/ip/sort) in the browser's `localStorage`, so they are per browser, not per account. To sync across devices, swap `loadSavedSearches` / `storeSavedSearches` for a DB-backed version (new migration + RLS by `auth.uid()`).

## Security Notes

- **No public signup:** User registration is admin-only to prevent unauthorized access
- **Service Role Key:** Never expose `SUPABASE_SERVICE_ROLE_KEY` to client-side code
- **Password requirements:** Minimum 6 characters
- **Role hierarchy:** admin > sub_admin > user
