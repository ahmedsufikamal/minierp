# MiniERP Copilot Instructions

## Project Overview
MiniERP is a Next.js 16 + Prisma 7 + PostgreSQL SaaS starter for small business operations. Features include customer/vendor management, invoices, bills, inventory tracking, and basic accounting. Multi-tenant support via `orgId` across all data models.

## Architecture Essentials

### Tech Stack
- **Frontend**: Next.js App Router, React 19, Tailwind CSS v4, Radix UI components
- **Backend**: Next.js Server Actions (all mutations use `"use server"`)
- **Database**: Prisma 7 (config-first), PostgreSQL
- **Auth**: Custom session-based (not Clerk in code, despite README mention)
- **UI Library**: Custom components in `src/components/ui/` (built on Radix UI)

### Data Model Patterns
- **Multi-tenant**: Every resource (`Customer`, `Product`, `Invoice`, etc.) has `orgId` field for org isolation
- **Cascade logic**: Invoice/Bill line items cascade on delete; Products use `SetNull` for soft references
- **Enums**: Status fields use TypeScript enums (`InvoiceStatus`, `BillStatus`, `InventoryMoveType`, `AccountType`)
- **Unique constraints**: Some entities like `Product` enforce `@@unique([orgId, sku])` to prevent duplicates per org
- **Timestamps**: All models include `createdAt` and `updatedAt` for audit trails

### Authentication & Authorization
- Session stored in cookie (`session` value decrypted in middleware)
- Middleware in `src/middleware.ts` protects routes; redirects unauthenticated users to `/sign-in`
- `getOrgIdOrUserId()` in `src/lib/auth.ts` extracts org context for all data queries
- All protected routes verify session before loading page data

### Module Structure
```
src/
├─ app/(app)/        # Protected feature modules (customers, products, invoices, etc.)
│  ├─ {module}/
│  │  ├─ page.tsx           # Page component (async, fetches data server-side)
│  │  ├─ components.tsx     # UI components
│  │  ├─ actions.ts         # Server actions for CRUD ("use server")
│  │  └─ *-actions.ts       # Feature-specific actions (e.g., kanban-actions.ts)
├─ lib/               # Utilities (auth, prisma client, session, utils)
└─ components/        # Shared UI components (shell, theme, Radix UI wrappers)
```

## Developer Workflows

### Setup & Running
```bash
npm install
npm run prisma:generate        # Generate Prisma client
npm run prisma:migrate:dev     # Create/apply migrations
npm run dev                     # Start Next.js dev server (port 3000)
```

### Database Workflow
- Changes to `prisma/schema.prisma` → run `npm run prisma:migrate:dev -- --name <description>`
- Inspect data in PostgreSQL: `npm run prisma:studio` (opens browser UI)
- Migrations auto-tracked in `prisma/migrations/` folder

### Key Commands (from `package.json`)
| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |
| `npm start -p 3000` | Run production build |
| `npm run prisma:generate` | Sync Prisma client with schema |
| `npm run prisma:migrate:dev` | Create & apply dev migration |
| `npm run prisma:migrate:deploy` | Deploy migration (prod) |

## Code Patterns & Conventions

### Server Actions Pattern
All mutations follow this structure from `src/app/(app)/customers/actions.ts`:
```typescript
"use server";
import { prisma } from "@/lib/prisma";
import { getOrgIdOrUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const MySchema = z.object({ /* validation rules */ });

export async function createRecord(formData: FormData) {
  const orgId = await getOrgIdOrUserId();
  const parsed = MySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.flatten().fieldErrors };
  
  await prisma.record.create({ data: { orgId, ...parsed.data } });
  revalidatePath("/path");
  return { ok: true };
}
```

**Key rules**:
1. Always validate with Zod before database operations
2. Always call `getOrgIdOrUserId()` and filter by `orgId` for data isolation
3. Call `revalidatePath()` after mutations to refresh cache
4. Return `{ ok: boolean, error?: fieldErrors }` for form feedback

### Page Components Pattern
Pages are async server components that fetch data directly:
```typescript
export const dynamic = "force-dynamic";  // Disable static caching

export default async function Page() {
  const orgId = await getOrgIdOrUserId();
  const data = await prisma.model.findMany({ where: { orgId } });
  return <ClientComponent data={data} />;
}
```

**Key patterns**:
- `export const dynamic = "force-dynamic"` on pages with real-time data
- Fetch data in page component, pass to UI components as props
- UI components should be "use client" only if they need interactivity

### Component Library
Radix UI components wrapped in `src/components/ui/`:
- `button.tsx`, `card.tsx`, `dialog.tsx`, `input.tsx`, `label.tsx`, `table.tsx`, `tabs.tsx`
- Use `cn()` utility (from `src/lib/cn.ts`) to merge Tailwind classes: `cn("base-class", condition && "extra-class")`
- Example: `<Button className={cn("rounded", variant === "outline" && "border")}>...</Button>`

### Multi-tenant Data Isolation
**Critical**: Every database query must filter by `orgId`:
```typescript
// ✅ Correct: org-scoped query
await prisma.customer.findMany({ where: { orgId, /* other filters */ } });

// ❌ Wrong: missing orgId filter (security issue!)
await prisma.customer.findMany({ where: { id: customerId } });
```

## Integration Points & Dependencies

### External Libraries
- **`@dnd-kit`**: Drag-and-drop (used in kanban-like features in `src/components/crm/kanban-board.tsx`)
- **`sonner`**: Toast notifications (Toaster in root layout)
- **`zod`**: Schema validation (required in all server actions)
- **`date-fns`**: Date utilities
- **`bcryptjs`**: Password hashing (if custom auth is extended)
- **`jose`**: JWT handling for sessions

### Database Relationships
- `Customer` ↔ `SalesInvoice` (1-to-many, Restrict on delete to prevent orphaning)
- `Vendor` ↔ `PurchaseBill` (1-to-many, Restrict on delete)
- `Product` ↔ `SalesInvoiceLine` / `PurchaseBillLine` (1-to-many, SetNull if product deleted)
- CRM extensions: `Customer` has `Contact`, `Opportunity`, `Activity`, `Task`

## Project-Specific Notes

### Naming Conventions
- File names: `kebab-case` (e.g., `new-customer-dialog.tsx`, `kanban-actions.ts`)
- React components: `PascalCase` (e.g., `CustomerTable`, `NewCustomerDialog`)
- Server actions: `camelCase` (e.g., `createCustomer`, `updateInvoice`)
- Database models: `PascalCase` (e.g., `Customer`, `SalesInvoice`)

### Environment Setup
Required `.env` variables:
```
DATABASE_URL=postgresql://user:pass@localhost:5432/minierp?schema=public
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...  # If using Clerk later
CLERK_SECRET_KEY=sk_test_...
```

### Performance Considerations
- Use `revalidatePath()` strategically; over-revalidating causes full page re-renders
- For frequently-queried data, consider caching strategies (Next.js cache functions)
- Prisma relations are lazy by default; use `include`/`select` to fetch related data in single query

---

**Last Updated**: January 31, 2026
