import { Module } from "@nestjs/common";
import { StatementsController } from "./statements.controller";
import { StatementsService } from "./statements.service";
import { SupabaseStorageService } from "./supabase-storage.service";
import { StatementParserService } from "./statement-parser.service";
import { CategorizerService } from "./categorizer.service";
import { TransactionsModule } from "../transactions/transactions.module";

@Module({
  imports: [TransactionsModule],
  controllers: [StatementsController],
  providers: [StatementsService, SupabaseStorageService, StatementParserService, CategorizerService],
  exports: [StatementsService],
})
export class StatementsModule {}
