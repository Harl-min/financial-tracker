import { Body, Controller, Delete, Get, Injectable, Module, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { PrismaService } from "../prisma/prisma.service";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthedUser } from "../auth/auth.guard";

class CreateCategoryDto {
  @IsString() name!: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsString() color?: string;
}

@Injectable()
class CategoriesService {
  constructor(private prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.category.findMany({ where: { userId }, orderBy: { name: "asc" } });
  }

  create(userId: string, dto: CreateCategoryDto) {
    return this.prisma.category.create({ data: { ...dto, userId } });
  }

  async remove(userId: string, id: string) {
    await this.prisma.category.deleteMany({ where: { id, userId, isSystem: false } });
    return { success: true };
  }
}

@ApiTags("categories")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller("categories")
class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list(@CurrentUser() user: AuthedUser) {
    return this.categories.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthedUser, @Body() dto: CreateCategoryDto) {
    return this.categories.create(user.id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthedUser, @Param("id") id: string) {
    return this.categories.remove(user.id, id);
  }
}

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
