import { EventSchemas, Inngest } from "inngest";

type Events = {
  "statement/uploaded": { data: { statementId: string; userId: string } };
  "statement/parsed": { data: { statementId: string; userId: string; transactionCount: number } };
  "email/weekly-summary": { data: { userId: string } };
};

export const inngest = new Inngest({
  id: "financial-tracker",
  schemas: new EventSchemas().fromRecord<Events>(),
});
