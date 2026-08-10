"use client";

import { ArrowDownRight, ArrowUpRight, PiggyBank, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, cn } from "@/lib/utils";
import { useSpendingSummary, useTransactions } from "@/hooks/use-finance-data";

export function SummaryCards() {
  const { data, isLoading } = useSpendingSummary();

  const cards = [
    { label: "Total income", value: data?.totalIncome, icon: ArrowUpRight, tone: "text-success" },
    { label: "Total expenses", value: data?.totalExpense, icon: ArrowDownRight, tone: "text-destructive" },
    { label: "Net savings", value: data?.netSavings, icon: PiggyBank, tone: "text-primary" },
    {
      label: "Savings rate",
      value: data ? data.savingsRate * 100 : undefined,
      icon: Wallet,
      tone: "text-primary",
      isPercent: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
            <c.icon className={cn("h-4 w-4", c.tone)} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading || c.value === undefined
                ? "—"
                : c.isPercent
                  ? `${c.value.toFixed(1)}%`
                  : formatCurrency(c.value)}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function TransactionsTable() {
  const { data, isLoading } = useTransactions(1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent transactions</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : !data || data.items.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No transactions yet — upload a bank statement to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 pr-4 font-medium">Description</th>
                  <th className="pb-2 pr-4 font-medium">Category</th>
                  <th className="pb-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((tx) => (
                  <tr key={tx.id} className="border-b last:border-0">
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {new Date(tx.occurredAt).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 pr-4">
                      <div className="font-medium">{tx.merchant || tx.description}</div>
                    </td>
                    <td className="py-2.5 pr-4">
                      {tx.category ? (
                        <Badge variant="secondary" style={{ backgroundColor: tx.category.color ?? undefined }}>
                          {tx.category.name}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Uncategorized</span>
                      )}
                    </td>
                    <td
                      className={cn(
                        "py-2.5 text-right font-medium",
                        tx.type === "INCOME" ? "text-success" : "text-foreground",
                      )}
                    >
                      {tx.type === "EXPENSE" ? "-" : "+"}
                      {formatCurrency(Number(tx.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
