# Financial Tracker

A personal finance tracker: upload a bank statement, get it auto-parsed and categorized in the
background, see your spending in charts, and ask an AI assistant questions about your money —
all from one dashboard.

## Stack

| Layer            | Choice                                             |
|-------------------|-----------------------------------------------------|
| Frontend          | Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui + TanStack Query |
| Backend           | NestJS + TypeScript                                |
| Database          | PostgreSQL (Neon) + Prisma                         |
| File storage      | Supabase Storage                                   |
| AI                | Vercel AI SDK + Gemini (swappable provider)         |
| Background jobs   | Inngest                                            |
| Auth              | Better Auth (Clerk swap documented inline)          |
| Charts            | Recharts                                           |
| Email             | Resend                                             |

## What's implemented

- **Floating upload widget** (bottom-left) — drag & drop a CSV or PDF bank statement. It uploads
  to Supabase Storage, creates a `BankStatement` row, and fires an Inngest event. A background
  job downloads the file, parses transactions (auto-detects common CSV column layouts; best-effort
  line parsing for PDFs), runs them through a keyword-based categorizer with a Gemini fallback for
  anything unmatched, and bulk-inserts `Transaction` rows. The widget polls status and shows
  live progress (Uploading → Processing → Done/Failed).
- **Floating AI chat widget** (bottom-right) — a support assistant built on the Vercel AI SDK's
  `useChat` + `streamText`, with tool-calling into the same NestJS endpoints the dashboard uses
  (spending summary, category breakdown, monthly trend, top merchants, transaction search,
  re-categorization, statement status). The assistant only ever acts as the logged-in user — every
  tool call forwards the user's session cookie to the API.
- **Dashboard** — summary cards, spending-by-category pie chart, income-vs-expense trend chart,
  recent transactions table.
- **Full transactions/categories CRUD API**, Prisma schema, auth guard, Swagger docs at `/docs`.

## Monorepo layout

```
apps/
  web/   Next.js frontend (dashboard, chat route, auth routes)
  api/   NestJS backend (transactions, categories, statements, analysis, inngest)
packages/
  db/    Shared Prisma schema + client + seed script
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env` in the repo root, then create symlinks/copies for each app
(`apps/web/.env.local` and `apps/api/.env`) — or just point both apps at the same root `.env` via
your process manager. Fill in:

- **`DATABASE_URL` / `DIRECT_URL`** — create a free project at [neon.tech](https://neon.tech), copy
  the pooled and direct connection strings.
- **`BETTER_AUTH_SECRET`** — `openssl rand -base64 32`.
- **`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`** — create a project at
  [supabase.com](https://supabase.com), then create a **private** storage bucket named
  `bank-statements` (Storage → New bucket, uncheck "Public").
- **`GOOGLE_GENERATIVE_AI_API_KEY`** — free key from
  [aistudio.google.com/apikey](https://aistudio.google.com/apikey). To switch models later, edit
  `apps/web/lib/ai/provider.ts`.
- **`INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY`** — from [inngest.com](https://inngest.com) (or run
  `npx inngest-cli@latest dev` locally against `http://localhost:4000/inngest` with no keys needed
  for local dev).
- **`RESEND_API_KEY`** — from [resend.com](https://resend.com). Optional for local dev; the email
  job silently no-ops if unset.

### 3. Database

```bash
npm run db:generate   # generate Prisma client
npm run db:push       # push schema to Neon
npm run db:seed        # seed default categories for a demo user
```

### 4. Run everything

```bash
npm run dev:api   # NestJS on :4000 (Swagger at /docs)
npm run dev:web   # Next.js on :3000
```

In a third terminal, run the Inngest dev server so background jobs (statement parsing, emails)
actually execute locally:

```bash
npx inngest-cli@latest dev -u http://localhost:4000/inngest
```

### 5. Auth note

The API's `AuthGuard` verifies requests by forwarding cookies to Better Auth's
`/api/auth/get-session` endpoint in the Next.js app. For quick local testing without wiring up a
full sign-in flow, the guard accepts an `x-user-id` header in non-production environments — e.g.
`curl -H "x-user-id: <id-from-db-seed>" http://localhost:4000/api/v1/transactions`.

To swap Better Auth for **Clerk**: delete `apps/web/lib/auth` and
`apps/web/app/api/auth/[...all]`, install `@clerk/nextjs`, wrap the root layout in
`<ClerkProvider>`, and replace the body of `apps/api/src/auth/auth.guard.ts` with Clerk's token
verification. Nothing else in the app depends on which provider is used — every controller reads
`request.user` via the `@CurrentUser()` decorator.

## Extending the statement parser

`apps/api/src/statements/statement-parser.service.ts` currently handles: CSV (auto-detects common
bank export column names) and a best-effort regex line-parser for text-based PDFs. For scanned/
image PDFs, add an OCR step (Google Vision, Tesseract, or a Gemini vision call) before
`parsePdfText`, and for OFX/QFX files add a small parser using the `ofx` npm package and register
it in `statements.service.ts#processStatement`.

## Extending the AI assistant

Tools the assistant can call live in `apps/web/lib/ai/tools.ts` — each one is a thin wrapper
around an existing NestJS endpoint. Add a new capability by adding a new `tool()` entry there; no
changes are needed in the chat route or widget.
