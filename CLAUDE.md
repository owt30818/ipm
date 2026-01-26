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
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase project credentials
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` - Cloudflare Turnstile keys

## Architecture

### Folder Structure

```
app/
  (auth)/          # Login/signup pages (public)
  (main)/          # Protected pages (dashboard, allocate, settings)
  actions/         # Server Actions (allocate-ips, bulk-update-ips, bulk-delete-ips)
  api/             # API routes
components/
  auth/            # Login/signup forms with Turnstile
  layout/          # Header, Sidebar, MobileNav
  ip/              # IP detail dialog, audit log list
  ui/              # Shadcn/ui primitives
lib/
  supabase/
    client.ts      # Browser client (use in Client Components)
    server.ts      # Server client (use in Server Components/Actions)
  types/
    database.ts    # Supabase generated types
```

### Supabase Client Usage

- **Server Components / Server Actions:** `import { createClient } from "@/lib/supabase/server"`
- **Client Components:** `import { createClient } from "@/lib/supabase/client"`

### Server Actions Pattern

Server Actions are in `app/actions/`. They use `"use server"` directive and handle auth internally:
```typescript
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
```

### Database RPC Functions

- `allocate_contiguous_ips(p_subnet_id, p_quantity, p_description, p_user_id)` - Allocates N contiguous available IPs with row-level locking

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
| `/allocate` | IP allocation forms (subnet selection, quantity input, CSV upload) |
| `/dashboard` | IP search and status overview with filtering |
| `/settings` | User management and audit log viewer (admin only) |

## UI Patterns

- **Mobile details:** Bottom Sheet (not new page) for IP details + audit log
- **Data tables:** Desktop uses `<Table>`, mobile uses card-based list
- **CSV upload:** Drag & drop on desktop, file picker button on mobile
- **Auth forms:** Include Cloudflare Turnstile widget
