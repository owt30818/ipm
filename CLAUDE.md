# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IP Address Management (IPAM) SaaS application with mobile-first responsive design. Features IP allocation, CSV bulk processing, audit logging, and role-based access control.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Auth:** Supabase Auth
- **UI:** Tailwind CSS + Shadcn/ui
- **Bot Protection:** Cloudflare Turnstile
- **CSV Processing:** Papaparse
- **Database:** PostgreSQL (via Supabase)

## Build & Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run linter
npm run lint

# Install Shadcn/ui components
npx shadcn@latest add sheet drawer button input select card table badge dialog alert-dialog toast tabs textarea separator label
```

## Docker Commands

```bash
# Development with hot reload (includes local PostgreSQL)
docker compose -f docker-compose.dev.yml up

# Production build and run
docker compose up --build

# Stop containers
docker compose down
```

## Architecture

### Responsive Layout Strategy

- **Desktop:** Fixed left sidebar navigation
- **Mobile:** Hidden sidebar with hamburger menu triggering a Sheet/Drawer component
- Use Tailwind breakpoints: `hidden md:block` (desktop), `block md:hidden` (mobile)

### Key Pages

| Route | Purpose |
|-------|---------|
| `/allocate` | IP management and allocation (input-focused) |
| `/dashboard` | Search and status overview (output-focused) |

### Database Schema (PostgreSQL)

```
profiles       → id, email, role
subnets        → id, cidr, name
ip_addresses   → id, subnet_id, ip_address(INET), status, description, allocated_at
audit_logs     → id, ip_address_id, user_id, action_type, old_value, new_value, created_at
```

## UI/UX Requirements

### Mobile-First Patterns (Critical)

1. **Drawer/Sheet Components:** Always use Shadcn/ui `Sheet` and `Drawer` for mobile navigation and detail views
2. **Bottom Sheet for Details:** On mobile, tapping a list item opens a bottom sheet (not a new page) showing details + audit log
3. **Full-Width Buttons:** Primary action buttons must be full-width or in a sticky bottom bar on mobile
4. **Numeric Inputs:** Use `type="number"` for quantity fields to trigger numeric keyboard
5. **Data Display:**
   - Desktop: Standard data tables
   - Mobile: Card-based list view with IP address + status badge on top, description + subnet below

### CSV Handling

- Desktop: Drag & drop zone
- Mobile: Standard file picker button

### Security

- Cloudflare Turnstile on login/signup forms
- JWT session management
- RBAC with admin/sub-admin roles
