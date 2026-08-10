import { useQuery } from "@tanstack/react-query";
import { api, CategoryBreakdown, MonthlyTrendPoint, SpendingSummary, Transaction } from "@/lib/api-client";

export function useSpendingSummary() {
  return useQuery({
    queryKey: ["analysis", "summary"],
    queryFn: () => api.get<SpendingSummary>("/analysis/summary"),
  });
}

export function useSpendingByCategory() {
  return useQuery({
    queryKey: ["analysis", "by-category"],
    queryFn: () => api.get<CategoryBreakdown[]>("/analysis/by-category"),
  });
}

export function useMonthlyTrend(months = 6) {
  return useQuery({
    queryKey: ["analysis", "trend", months],
    queryFn: () => api.get<MonthlyTrendPoint[]>(`/analysis/trend?months=${months}`),
  });
}

export function useTransactions(page = 1) {
  return useQuery({
    queryKey: ["transactions", page],
    queryFn: () =>
      api.get<{ items: Transaction[]; total: number; totalPages: number }>(
        `/transactions?page=${page}&pageSize=10`,
      ),
  });
}
