import { createGoogleGenerativeAI } from "@ai-sdk/google";

/**
 * Central place to configure the model the chat assistant uses.
 *
 * To swap providers later: `npm install @ai-sdk/openai` (or anthropic, etc.),
 * change this file to `createOpenAI(...)` / `createAnthropic(...)`, and
 * update `AI_MODEL` in .env. Nothing in app/api/chat/route.ts or the chat
 * widget needs to change — they just import `model` from here.
 */
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

export const model = google(process.env.AI_MODEL ?? "gemini-2.0-flash");
