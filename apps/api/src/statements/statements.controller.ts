import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Body,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthedUser } from "../auth/auth.guard";
import { StatementsService } from "./statements.service";

const ALLOWED_TYPES = ["csv", "pdf", "ofx"];
const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

@ApiTags("statements")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller("statements")
export class StatementsController {
  constructor(private readonly statements: StatementsService) {}

  @Post("upload")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_SIZE_BYTES } }))
  async upload(
    @CurrentUser() user: AuthedUser,
    @UploadedFile() file: Express.Multer.File,
    @Body("bankAccountId") bankAccountId?: string,
  ) {
    if (!file) throw new BadRequestException("No file uploaded");
    const ext = file.originalname.split(".").pop()?.toLowerCase();
    if (!ext || !ALLOWED_TYPES.includes(ext)) {
      throw new BadRequestException(`Unsupported file type. Allowed: ${ALLOWED_TYPES.join(", ")}`);
    }
    return this.statements.upload(user.id, file, bankAccountId);
  }

  @Get()
  list(@CurrentUser() user: AuthedUser) {
    return this.statements.list(user.id);
  }

  /** Frontend polls this while a statement is PARSING to update the floating upload widget. */
  @Get(":id")
  findOne(@CurrentUser() user: AuthedUser, @Param("id") id: string) {
    return this.statements.findOne(user.id, id);
  }
}
