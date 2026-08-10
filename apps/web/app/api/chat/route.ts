import { streamText, convertToCoreMessages } from "ai";
import { model } from "@/lib/ai/provider";
import { buildTools } from "@/lib/ai/tools";

export const maxDuration = 30;

const SYSTEM_PROMPT = `You are the in-app financial assistant for a personal finance tracker.
You help users understand their spending, income, and transactions, and can fix miscategorized
transactions on their behalf.

Guidelines:
- Always use your tools to fetch real data before answering questions about the user's finances —
  never guess or make up numbers.
- Keep answers concise and use concrete figures (amounts, percentages, dates).
- If the user wants to upload a bank statement, tell them to use the floating upload button
  (bottom-right of the screen) — you cannot receive file uploads directly in chat.
- If a tool call fails or returns nothing, say so plainly rather than inventing data.
- Format money with a currency symbol and two decimals.
- You are not a licensed financial advisor; for investment or tax advice, note that and suggest a professional.`;

export async function POST(req: Request) {
  const { messages } = await req.json();
  const cookieHeader = req.headers.get("cookie") ?? "";

  const result = streamText({
    model,
    system: SYSTEM_PROMPT,
    messages: convertToCoreMessages(messages),
    tools: buildTools(cookieHeader),
    maxSteps: 5, // allow the model to call a tool, then respond using the result
  });

  return result.toDataStreamResponse();
}
