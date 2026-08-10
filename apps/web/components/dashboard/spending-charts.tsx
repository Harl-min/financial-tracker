"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { useMonthlyTrend, useSpendingByCategory } from "@/hooks/use-finance-data";

const FALLBACK_COLORS = ["#6366f1", "#22c55e", "#f97316", "#0ea5e9", "#ec4899", "#eab308", "#a855f7", "#ef4444"];

export function SpendingByCategoryChart() {
  const { data, isLoading } = useSpendingByCategory();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending by category</CardTitle>
        <CardDescription>Where your money went this period</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Loading…</div>
        ) : !data || data.length === 0 ? (
          <EmptyState message="No expenses yet — upload a statement to see your breakdown." />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={data} dataKey="total" nameKey="categoryName" innerRadius={60} outerRadius={100} paddingAngle={2}>
                {data.map((entry, index) => (
                  <Cell key={entry.categoryId ?? index} fill={entry.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function MonthlyTrendChart() {
  const { data, isLoading } = useMonthlyTrend(6);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Income vs. expenses</CardTitle>
        <CardDescription>Last 6 months</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Loading…</div>
        ) : !data || data.length === 0 ? (
          <EmptyState message="No transaction history yet." />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="income" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} name="Income" />
              <Bar dataKey="expense" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Expense" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="flex h-64 items-center justify-center text-center text-sm text-muted-foreground">{message}</div>;
}
