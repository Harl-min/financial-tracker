import { Module } from "@nestjs/common";
import { InngestController } from "./inngest.controller";
import { InngestService } from "./inngest.service";
import { StatementsModule } from "../statements/statements.module";

@Module({
  imports: [StatementsModule],
  controllers: [InngestController],
  providers: [InngestService],
})
export class InngestModule {}
