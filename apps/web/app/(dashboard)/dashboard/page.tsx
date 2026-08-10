import { SummaryCards, TransactionsTable } from "@/components/dashboard/summary-and-table";
import { SpendingByCategoryChart, MonthlyTrendChart } from "@/components/dashboard/spending-charts";
import { FloatingUploadWidget } from "@/components/dashboard/floating-upload";
import { AiChatWidget } from "@/components/dashboard/ai-chat-widget";

export default function DashboardPage() {
  return (
    <main className="container py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financial Tracker</h1>
          <p className="text-sm text-muted-foreground">Your spending at a glance</p>
        </div>
      </div>

      <div className="space-y-6">
        <SummaryCards />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SpendingByCategoryChart />
          <MonthlyTrendChart />
        </div>

        <TransactionsTable />
      </div>

      {/* Floating widgets — always accessible from anywhere on the dashboard */}
      <FloatingUploadWidget />
      <AiChatWidget />
    </main>
  );
}
