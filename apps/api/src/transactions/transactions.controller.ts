import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthedUser } from "../auth/auth.guard";
import { TransactionsService } from "./transactions.service";
import { CreateTransactionDto, QueryTransactionsDto, UpdateTransactionDto } from "./dto";

@ApiTags("transactions")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller("transactions")
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  list(@CurrentUser() user: AuthedUser, @Query() query: QueryTransactionsDto) {
    return this.transactions.list(user.id, query);
  }

  @Get(":id")
  findOne(@CurrentUser() user: AuthedUser, @Param("id") id: string) {
    return this.transactions.findOne(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: AuthedUser, @Body() dto: CreateTransactionDto) {
    return this.transactions.create(user.id, dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthedUser, @Param("id") id: string, @Body() dto: UpdateTransactionDto) {
    return this.transactions.update(user.id, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthedUser, @Param("id") id: string) {
    return this.transactions.remove(user.id, id);
  }
}
