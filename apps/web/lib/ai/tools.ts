import { tool } from "ai";
import { z } from "zod";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Builds the tool set the chat assistant can call. Every tool simply proxies
 * to the same NestJS endpoints the dashboard UI uses — the assistant has no
 * special privileges, it acts as the logged-in user (their session cookie is
 * forwarded on every call), so it can only ever see/change what the user
 * themselves could through the UI.
 */
export function buildTools(cookieHeader: string) {
  const authedFetch = (path: string, init?: RequestInit) =>
    fetch(`${API_URL}/api/v1${path}`, {
      ...init,
      headers: { cookie: cookieHeader, "Content-Type": "application/json", ...init?.headers },
    }).then(async (res) => {
      if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
      return res.json();
    });

  return {
    getSpendingSummary: tool({
      description:
        "Get the user's total income, total expenses, net savings, and savings rate for an optional date range. Use this for questions like 'how much did I spend' or 'what's my savings rate'.",
      parameters: z.object({
        from: z.string().optional().describe("ISO date, start of range"),
        to: z.string().optional().describe("ISO date, end of range"),
      }),
      execute: async ({ from, to }) => {
        const params = new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) });
        return authedFetch(`/analysis/summary?${params}`);
      },
    }),

    getSpendingByCategory: tool({
      description:
        "Get a breakdown of spending by category for an optional date range. Use this for 'what am I spending the most on' or 'break down my spending'.",
      parameters: z.object({
        from: z.string().optional(),
        to: z.string().optional(),
      }),
      execute: async ({ from, to }) => {
        const params = new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) });
        return authedFetch(`/analysis/by-category?${params}`);
      },
    }),

    getMonthlyTrend: tool({
      description: "Get income vs expense totals per month for the last N months. Use for trend/history questions.",
      parameters: z.object({ months: z.number().min(1).max(24).default(6) }),
      execute: async ({ months }) => authedFetch(`/analysis/trend?months=${months}`),
    }),

    getTopMerchants: tool({
      description: "Get the merchants the user spends the most money at.",
      parameters: z.object({ limit: z.number().min(1).max(20).default(5) }),
      execute: async ({ limit }) => authedFetch(`/analysis/top-merchants?limit=${limit}`),
    }),

    searchTransactions: tool({
      description:
        "Search/list the user's transactions with optional filters. Use for 'show me my transactions at X' or 'what did I buy last week'.",
      parameters: z.object({
        search: z.string().optional().describe("Text to search in description/merchant"),
        from: z.string().optional(),
        to: z.string().optional(),
        type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]).optional(),
        page: z.number().default(1),
      }),
      execute: async ({ search, from, to, type, page }) => {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: "10",
          ...(search ? { search } : {}),
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
          ...(type ? { type } : {}),
        });
        return authedFetch(`/transactions?${params}`);
      },
    }),

    updateTransactionCategory: tool({
      description:
        "Re-categorize a specific transaction by id. Use this when the user asks to fix or change a transaction's category.",
      parameters: z.object({
        transactionId: z.string(),
        categoryId: z.string(),
      }),
      execute: async ({ transactionId, categoryId }) =>
        authedFetch(`/transactions/${transactionId}`, {
          method: "PATCH",
          body: JSON.stringify({ categoryId }),
        }),
    }),

    listCategories: tool({
      description: "List the user's available spending categories (needed before calling updateTransactionCategory).",
      parameters: z.object({}),
      execute: async () => authedFetch("/categories"),
    }),

    listRecentStatements: tool({
      description: "List the user's recently uploaded bank statements and their processing status.",
      parameters: z.object({}),
      execute: async () => authedFetch("/statements"),
    }),
  };
}
