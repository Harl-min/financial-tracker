import { Controller, Get, Injectable, Module, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../prisma/prisma.service";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthedUser } from "../auth/auth.guard";

@Injectable()
export class AnalysisService {
  constructor(private prisma: PrismaService) {}

  /** High-level numbers for the dashboard header cards. */
  async summary(userId: string, from?: string, to?: string) {
    const range = dateRange(from, to);
    const [income, expense] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { userId, type: "INCOME", occurredAt: range },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { userId, type: "EXPENSE", occurredAt: range },
        _sum: { amount: true },
      }),
    ]);

    const totalIncome = Number(income._sum.amount ?? 0);
    const totalExpense = Number(expense._sum.amount ?? 0);

    return {
      totalIncome,
      totalExpense,
      netSavings: totalIncome - totalExpense,
      savingsRate: totalIncome > 0 ? (totalIncome - totalExpense) / totalIncome : 0,
    };
  }

  /** Breakdown by category — feeds the Recharts pie/bar chart. */
  async byCategory(userId: string, from?: string, to?: string) {
    const range = dateRange(from, to);
    const grouped = await this.prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { userId, type: "EXPENSE", occurredAt: range },
      _sum: { amount: true },
      _count: true,
    });

    const categories = await this.prisma.category.findMany({
      where: { id: { in: grouped.map((g: { categoryId: any }) => g.categoryId).filter((id: any): id is string => !!id) } },
    }) as Array<{ id: string; name: string; color: string }>;
    const byId = new Map<string, { name: string; color: string }>(
      categories.map((c) => [c.id, { name: c.name, color: c.color }])
    );

    return grouped
      .map((g: { categoryId: unknown; _sum: { amount: any; }; _count: any; }) => ({
        categoryId: g.categoryId,
        categoryName: g.categoryId ? byId.get(g.categoryId as string)?.name ?? "Uncategorized" : "Uncategorized",
        color: g.categoryId ? byId.get(g.categoryId as string)?.color : "#94a3b8",
        total: Number(g._sum.amount ?? 0),
        count: g._count,
      }))
      .sort((a: { total: number; }, b: { total: number; }) => b.total - a.total);
  }

  /** Month-over-month income vs expense — feeds the trend line/bar chart. */
  async monthlyTrend(userId: string, months = 6) {
    const since = new Date();
    since.setMonth(since.getMonth() - months + 1);
    since.setDate(1);

    const txs = await this.prisma.transaction.findMany({
      where: { userId, occurredAt: { gte: since } },
      select: { amount: true, type: true, occurredAt: true },
    });

    const buckets = new Map<string, { income: number; expense: number }>();
    for (const tx of txs) {
      const key = `${tx.occurredAt.getFullYear()}-${String(tx.occurredAt.getMonth() + 1).padStart(2, "0")}`;
      const bucket = buckets.get(key) ?? { income: 0, expense: 0 };
      if (tx.type === "INCOME") bucket.income += Number(tx.amount);
      if (tx.type === "EXPENSE") bucket.expense += Number(tx.amount);
      buckets.set(key, bucket);
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, ...v, net: v.income - v.expense }));
  }

  async topMerchants(userId: string, limit = 5, from?: string, to?: string) {
    const range = dateRange(from, to);
    const grouped = await this.prisma.transaction.groupBy({
      by: ["merchant"],
      where: { userId, type: "EXPENSE", occurredAt: range, merchant: { not: null } },
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: "desc" } },
      take: limit,
    });
    return grouped.map((g: { merchant: any; _sum: { amount: any; }; _count: any; }) => ({ merchant: g.merchant, total: Number(g._sum.amount ?? 0), count: g._count }));
  }
}

function dateRange(from?: string, to?: string) {
  if (!from && !to) return undefined;
  return { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };
}

@ApiTags("analysis")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller("analysis")
class AnalysisController {
  constructor(private readonly analysis: AnalysisService) {}

  @Get("summary")
  summary(@CurrentUser() user: AuthedUser, @Query("from") from?: string, @Query("to") to?: string) {
    return this.analysis.summary(user.id, from, to);
  }

  @Get("by-category")
  byCategory(@CurrentUser() user: AuthedUser, @Query("from") from?: string, @Query("to") to?: string) {
    return this.analysis.byCategory(user.id, from, to);
  }

  @Get("trend")
  trend(@CurrentUser() user: AuthedUser, @Query("months") months?: string) {
    return this.analysis.monthlyTrend(user.id, months ? Number(months) : undefined);
  }

  @Get("top-merchants")
  topMerchants(@CurrentUser() user: AuthedUser, @Query("limit") limit?: string) {
    return this.analysis.topMerchants(user.id, limit ? Number(limit) : undefined);
  }
}

@Module({
  controllers: [AnalysisController],
  providers: [AnalysisService],
  exports: [AnalysisService],
})
export class AnalysisModule {}
