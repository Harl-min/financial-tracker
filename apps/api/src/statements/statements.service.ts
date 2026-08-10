import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SupabaseStorageService } from "./supabase-storage.service";
import { StatementParserService } from "./statement-parser.service";
import { CategorizerService } from "./categorizer.service";
import { TransactionsService } from "../transactions/transactions.service";
import { inngest } from "../inngest/inngest.client";

@Injectable()
export class StatementsService {
  private readonly logger = new Logger(StatementsService.name);

  constructor(
    private prisma: PrismaService,
    private storage: SupabaseStorageService,
    private parser: StatementParserService,
    private categorizer: CategorizerService,
    private transactions: TransactionsService,
  ) {}

  /** Step 1: receive the upload, store the raw file, create a pending record, hand off to Inngest. */
  async upload(userId: string, file: Express.Multer.File, bankAccountId?: string) {
    const fileType = file.originalname.split(".").pop()?.toLowerCase() ?? "unknown";
    const storagePath = await this.storage.upload(userId, file.originalname, file.buffer, file.mimetype);

    const statement = await this.prisma.bankStatement.create({
      data: {
        userId,
        bankAccountId,
        fileName: file.originalname,
        storagePath,
        fileType,
        status: "UPLOADED",
      },
    });

    // Hand off heavy lifting (parsing, categorization, DB writes) to a
    // background job so the upload request returns instantly.
    await inngest.send({
      name: "statement/uploaded",
      data: { statementId: statement.id, userId },
    });

    return statement;
  }

  async list(userId: string) {
    return this.prisma.bankStatement.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(userId: string, id: string) {
    const statement = await this.prisma.bankStatement.findFirst({ where: { id, userId } });
    if (!statement) throw new NotFoundException("Statement not found");
    return statement;
  }

  /**
   * Step 2 (runs inside the Inngest function): download the file, parse it,
   * categorize each row, bulk-insert transactions, and mark the statement
   * parsed. Idempotent-ish: re-running on a PARSED statement is a no-op.
   */
  async processStatement(statementId: string) {
    const statement = await this.prisma.bankStatement.findUniqueOrThrow({ where: { id: statementId } });
    if (statement.status === "PARSED") return statement;

    await this.prisma.bankStatement.update({ where: { id: statementId }, data: { status: "PARSING" } });

    try {
      const buffer = await this.storage.download(statement.storagePath);
      const rows =
        statement.fileType === "csv"
          ? this.parser.parseCsv(buffer)
          : this.parser.parsePdfText(buffer.toString("utf-8"));

      if (rows.length === 0) {
        throw new Error("No transactions could be extracted from this file.");
      }

      const categorized = await this.categorizer.categorize(
        statement.userId,
        rows.map((r) => ({ description: r.description, merchant: r.merchant })),
      );

      await this.transactions.createMany(
        statement.userId,
        statement.id,
        statement.bankAccountId,
        rows.map((r, i) => ({
          description: r.description,
          merchant: r.merchant,
          amount: r.amount,
          type: r.type,
          occurredAt: r.occurredAt,
          rawDescription: r.rawDescription,
          categoryId: categorized[i]?.categoryId ?? undefined,
          aiCategorized: categorized[i]?.aiCategorized,
          aiConfidence: categorized[i]?.aiConfidence,
        })),
      );

      const dates = rows.map((r) => r.occurredAt.getTime());
      return this.prisma.bankStatement.update({
        where: { id: statementId },
        data: {
          status: "PARSED",
          parsedAt: new Date(),
          transactionCount: rows.length,
          periodStart: new Date(Math.min(...dates)),
          periodEnd: new Date(Math.max(...dates)),
        },
      });
    } catch (err) {
      this.logger.error(`Failed to parse statement ${statementId}: ${(err as Error).message}`);
      return this.prisma.bankStatement.update({
        where: { id: statementId },
        data: { status: "FAILED", errorMessage: (err as Error).message },
      });
    }
  }
}
