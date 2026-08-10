const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...init,
    credentials: "include", // forwards the Better Auth session cookie
    headers: {
      ...(init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? "Request failed");
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body instanceof FormData ? body : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// ---- Domain types (mirrors the Prisma models exposed by the API) ----

export interface Category {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
}

export interface Transaction {
  id: string;
  description: string;
  merchant?: string | null;
  amount: string; // Decimal serializes as string over JSON
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  occurredAt: string;
  category?: Category | null;
  aiCategorized: boolean;
}

export interface BankStatement {
  id: string;
  fileName: string;
  status: "UPLOADED" | "PARSING" | "PARSED" | "FAILED";
  transactionCount: number;
  errorMessage?: string | null;
  createdAt: string;
}

export interface SpendingSummary {
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  savingsRate: number;
}

export interface CategoryBreakdown {
  categoryId: string | null;
  categoryName: string;
  color?: string | null;
  total: number;
  count: number;
}

export interface MonthlyTrendPoint {
  month: string;
  income: number;
  expense: number;
  net: number;
}
