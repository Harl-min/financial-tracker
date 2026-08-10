import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Request } from "express";

export interface AuthedUser {
  id: string;
  email: string;
  name?: string | null;
}

/**
 * Verifies the caller's identity.
 *
 * Default flow (Better Auth): Better Auth runs inside the Next.js app. This
 * guard forwards the incoming cookies to Next's `/api/auth/get-session`
 * endpoint and trusts its response. This keeps all auth logic (password
 * hashing, OAuth, email verification, session rotation) in one place.
 *
 * Swapping to Clerk: replace the body of `canActivate` with
 * `clerkClient.verifyToken(bearerToken)` (or `@clerk/backend`'s
 * `authenticateRequest`) and map the returned Clerk user id onto
 * `request.user`. Nothing else in the app depends on which provider you use
 * because every controller only reads `request.user` via `@CurrentUser()`.
 *
 * Dev shortcut: if `x-user-id` header is present and NODE_ENV !== 'production',
 * it's trusted directly so you can hit the API with curl/Postman while wiring
 * up the frontend auth flow.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    if (process.env.NODE_ENV !== "production") {
      const devUserId = request.headers["x-user-id"];
      if (devUserId && typeof devUserId === "string") {
        (request as any).user = { id: devUserId, email: `${devUserId}@dev.local` } satisfies AuthedUser;
        return true;
      }
    }

    const cookie = request.headers.cookie;
    if (!cookie) {
      throw new UnauthorizedException("No session cookie provided");
    }

    const authUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
    const res = await fetch(`${authUrl}/api/auth/get-session`, {
      headers: { cookie },
    });

    if (!res.ok) {
      throw new UnauthorizedException("Could not verify session");
    }

    const data = (await res.json()) as { user?: AuthedUser } | null;
    if (!data?.user) {
      throw new UnauthorizedException("Invalid or expired session");
    }

    (request as any).user = data.user;
    return true;
  }
}
