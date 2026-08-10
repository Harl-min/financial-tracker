import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.module";
import { TransactionsModule } from "./transactions/transactions.module";
import { CategoriesModule } from "./categories/categories.module";
import { StatementsModule } from "./statements/statements.module";
import { AnalysisModule } from "./analysis/analysis.module";
import { InngestModule } from "./inngest/inngest.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    TransactionsModule,
    CategoriesModule,
    StatementsModule,
    AnalysisModule,
    InngestModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
