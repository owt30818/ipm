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

## Architecture

### Folder Structure

```
app/
  (auth)/          # Login page (public) - signup removed for security
  (main)/          # Protected pages (dashboard, allocate, settings)
  actions/         # Server Actions
    allocate-ips.ts
    bulk-update-ips.ts
    bulk-delete-ips.ts
    create-user.ts       # Admin: create new users
    update-password.ts   # User: change own password
  api/             # API routes
components/
  auth/            # Login form with Turnstile
  layout/          # Header (links to settings), Sidebar, MobileNav
  ip/              # IP detail dialog, audit log list
  ui/              # Shadcn/ui primitives
lib/
  supabase/
    client.ts      # Browser client (use in Client Components)
    server.ts      # Server client (use in Server Components/Actions)
    admin.ts       # Admin client (use for user management, bypasses RLS)
  types/
    database.ts    # Supabase generated types
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
- `search_ip_addresses(...)` - IP list search (SECURITY INVOKER, RLS applies)

RPCs are executable by `authenticated` only (never `anon`). Migrations 009/010 enforce this; keep `REVOKE ... FROM PUBLIC, anon` in any new function.

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

### Responsive Layout

- **Desktop:** Fixed left sidebar (`hidden md:block`)
- **Mobile:** Hamburger menu → Sheet/Drawer (`block md:hidden`)

### Key Routes

| Route | Purpose |
|-------|---------|
| `/login` | Login page with Turnstile protection |
| `/allocate` | IP allocation forms (subnet selection, quantity input, CSV upload) |
| `/dashboard` | IP search and status overview with filtering |
| `/settings` | Profile, user management (admin), audit log viewer |
| `/about` | App version/build date/commit and installed package versions (from `next.config.ts` build metadata) |

### User Management (Settings Page)

**Profile Tab (all users):**
- View account info (email, role, join date)
- Change password via dialog

**User Management Tab (admin only):**
- View all users with role badges
- Add new users (sub_admin/user) via dialog
- Change user roles via dropdown

**Audit Log Tab (admin/sub_admin):**
- View system change history

## UI Patterns

- **Mobile details:** Bottom Sheet (not new page) for IP details + audit log
- **Data tables:** Desktop uses `<Table>`, mobile uses card-based list
- **CSV upload:** Drag & drop on desktop, file picker button on mobile
- **Auth forms:** Include Cloudflare Turnstile widget
- **Dialogs:** Used for password change and user creation (inline JSX, not function components to avoid re-render issues)
- **Header:** User email links to `/settings` page

## Security Notes

- **No public signup:** User registration is admin-only to prevent unauthorized access
- **Service Role Key:** Never expose `SUPABASE_SERVICE_ROLE_KEY` to client-side code
- **Password requirements:** Minimum 6 characters
- **Role hierarchy:** admin > sub_admin > user
