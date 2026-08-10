import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthedUser } from "../../auth/auth.guard";

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthedUser => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
