# ERPNext-Style Shell

## Overview

The authenticated shell now uses the live `src/components/shell/*` path and follows an ERPNext-inspired layout:

- persistent desktop sidebar
- collapsible icon-only sidebar with local persistence
- mobile off-canvas sidebar
- module switcher with a two-column mega-menu
- sidebar footer user chip

## Shell Configuration

Navigation lives in `src/components/shell/shell-config.ts`.

Key structures:

- `shellModules`: top-level module definitions
- `shellHomeItems`: global home/dashboard shortcuts
- `resolveActiveModule(pathname)`: selects the current module from the route
- `flattenShellNavItems()`: produces a unique flat list for global nav consumers

Each module provides:

- `id`
- `label`
- `description`
- `icon`
- `homeHref`
- `matchers`
- `sections[]`

Each section contains `items[]`, and items can optionally expose `children[]` for nested setup links.

## Sidebar Persistence

Desktop collapse state is stored in local storage under:

- `minierp-sidebar-collapsed`

Helpers live in `src/components/shell/sidebar-state.ts`.

Behavior:

- `1` / `true` means collapsed
- `0` or missing means expanded
- mobile always opens expanded inside the off-canvas dialog

## Theme Contract

Theme state is handled by `next-themes` using:

- storage key: `minierp-ui-theme`
- `attribute="class"`
- `defaultTheme="system"`
- `enableSystem=true`

`src/app/layout.tsx` seeds local storage before the provider mounts when the server has an explicit `LIGHT` or `DARK` preference and no client value exists. This avoids post-mount theme flips.

`src/components/theme-preference-sync.tsx` now only syncs client theme changes back to `/api/account/preferences`; it no longer calls `setTheme()` on mount.

## Settings IA

User settings moved to:

- `/settings/user`
- `/settings/user/profile`
- `/settings/user/security`
- `/settings/user/sessions`
- `/settings/user/api`
- `/settings/user/connections`

Compatibility:

- `/settings/account` redirects to `/settings/user`

## Admin User Management

The ERPNext-style user admin flow lives at:

- `/admin/users`
- `/admin/users/[id]`

The legacy `/admin` page remains available, but the primary shell navigation now points to `/admin/users`.

The user record page is intentionally company-context-aware because IAM roles and membership permission overrides are company-scoped.

## API Facade

The shell/settings/admin UI uses the new Next.js route facade:

- `/api/iam/me`
- `/api/iam/me/sessions`
- `/api/iam/me/sessions/[id]/revoke`
- `/api/iam/admin/users`
- `/api/iam/admin/users/[id]`
- `/api/iam/admin/roles`
- `/api/iam/admin/users/[id]/roles`
- `/api/iam/admin/users/[id]/sessions`
- `/api/iam/admin/users/[id]/sessions/[sessionId]/revoke`

These routes reuse the existing IAM guards and Prisma models; they do not proxy to the Rust service.
