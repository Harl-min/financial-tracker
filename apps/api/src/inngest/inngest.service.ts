import { Injectable } from "@nestjs/common";
import { inngest } from "./inngest.client";
import { StatementsService } from "../statements/statements.service";
import { PrismaService } from "../prisma/prisma.service";
import { Resend } from "resend";

@Injectable()
export class InngestService {
  public functions: any[];

  constructor(
    private statements: StatementsService,
    private prisma: PrismaService,
  ) {
    const resend = new Resend(process.env.RESEND_API_KEY);

    const parseStatement = inngest.createFunction(
      { id: "parse-bank-statement", retries: 2 },
      { event: "statement/uploaded" },
      async ({ event, step }) => {
        const { statementId, userId } = event.data;

        const parsed = await step.run("parse-and-import", () =>
          this.statements.processStatement(statementId),
        );

        if (parsed.status === "PARSED") {
          await step.sendEvent("emit-parsed-event", {
            name: "statement/parsed",
            data: {
              statementId,
              userId,
              transactionCount: parsed.transactionCount,
            },
          });
        }

        return parsed;
      },
    );

    const notifyOnParsed = inngest.createFunction(
      { id: "notify-statement-parsed" },
      { event: "statement/parsed" },
      async ({ event, step }) => {
        const user = await step.run("get-user", async () =>
          this.prisma.user.findUniqueOrThrow({
            where: { id: event.data.userId },
          }),
        );

        await step.run("send-email", async () => {
          if (!process.env.RESEND_API_KEY) return; // no-op until Resend is configured
          await resend.emails.send({
            from:
              process.env.RESEND_FROM_EMAIL ??
              "Financial Tracker <notifications@example.com>",
            to: user.email,
            subject: "Your statement has been processed",
            html: `<p>Hi ${user.name ?? ""},</p><p>We imported <strong>${event.data.transactionCount}</strong> transactions from your latest bank statement. Open the dashboard to review categorization and spending insights.</p>`,
          });
        });
      },
    );

    // Example scheduled job: weekly spending digest, every Monday 8am.
    const weeklyDigest = inngest.createFunction(
      { id: "weekly-spending-digest" },
      { cron: "0 8 * * 1" },
      async ({ step }) => {
        const users = await step.run(
          "get-users",
          async (): Promise<{ id: string }[]> => {
            return this.prisma.user.findMany({ select: { id: true } });
          },
        );

        for (const u of users) {
          await step.sendEvent("queue-digest", {
            name: "email/weekly-summary",
            data: { userId: u.id },
          });
        }
      },
    );

    this.functions = [parseStatement, notifyOnParsed, weeklyDigest];
  }
}
