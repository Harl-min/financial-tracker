import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTransactionDto, QueryTransactionsDto, UpdateTransactionDto } from "./dto";

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string, query: QueryTransactionsDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 25, 100);

    const where: Prisma.TransactionWhereInput = {
      userId,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.from || query.to
        ? {
            occurredAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { description: { contains: query.search, mode: "insensitive" } },
              { merchant: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: { category: true, bankAccount: true },
        orderBy: { occurredAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(userId: string, id: string) {
    const tx = await this.prisma.transaction.findFirst({
      where: { id, userId },
      include: { category: true, bankAccount: true },
    });
    if (!tx) throw new NotFoundException("Transaction not found");
    return tx;
  }

  create(userId: string, dto: CreateTransactionDto) {
    return this.prisma.transaction.create({
      data: {
        userId,
        description: dto.description,
        merchant: dto.merchant,
        amount: dto.amount,
        type: dto.type,
        categoryId: dto.categoryId,
        bankAccountId: dto.bankAccountId,
        occurredAt: new Date(dto.occurredAt),
        isRecurring: dto.isRecurring ?? false,
        notes: dto.notes,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateTransactionDto) {
    await this.findOne(userId, id);
    return this.prisma.transaction.update({
      where: { id },
      data: {
        ...dto,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.prisma.transaction.delete({ where: { id } });
    return { success: true };
  }

  /** Bulk insert used by the statement parser / Inngest job. */
  createMany(
    userId: string,
    statementId: string,
    bankAccountId: string | null,
    rows: {
      description: string;
      merchant?: string;
      amount: number;
      type: "INCOME" | "EXPENSE" | "TRANSFER";
      occurredAt: Date;
      categoryId?: string;
      aiCategorized?: boolean;
      aiConfidence?: number;
      rawDescription?: string;
    }[],
  ) {
    return this.prisma.transaction.createMany({
      data: rows.map((r) => ({
        userId,
        statementId,
        bankAccountId: bankAccountId ?? undefined,
        description: r.description,
        merchant: r.merchant,
        amount: r.amount,
        type: r.type,
        occurredAt: r.occurredAt,
        categoryId: r.categoryId,
        aiCategorized: r.aiCategorized ?? false,
        aiConfidence: r.aiConfidence,
        rawDescription: r.rawDescription,
      })),
    });
  }
}
