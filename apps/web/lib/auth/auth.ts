import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@financial-tracker/db";

/**
 * Better Auth instance. This is the single source of truth for sessions —
 * the NestJS API verifies requests by calling `/api/auth/get-session`
 * (see apps/api/src/auth/auth.guard.ts), so nothing else needs to know how
 * auth is implemented under the hood.
 *
 * Swapping to Clerk: delete this file and app/api/auth/[...all], install
 * `@clerk/nextjs`, wrap the root layout in <ClerkProvider>, and update
 * auth.guard.ts on the API side to verify Clerk session tokens instead.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
          },
        }
      : {}),
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh once per day of activity
  },
  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"],
});

export type Session = typeof auth.$Infer.Session;
