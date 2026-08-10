import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

// Keyword -> default system category name. Checked against merchant/description
// (case-insensitive substring match) before falling back to AI.
const RULES: { keywords: string[]; category: string }[] = [
  { keywords: ["walmart", "trader joe", "whole foods", "kroger", "aldi", "safeway", "grocery"], category: "Groceries" },
  { keywords: ["rent", "landlord", "apartment", "mortgage"], category: "Rent & Housing" },
  { keywords: ["electric", "water bill", "gas company", "utility", "comcast", "internet", "verizon", "at&t"], category: "Utilities" },
  { keywords: ["uber", "lyft", "shell", "chevron", "exxon", "parking", "transit", "metro"], category: "Transport" },
  { keywords: ["restaurant", "starbucks", "mcdonald", "chipotle", "doordash", "grubhub", "cafe", "coffee"], category: "Dining & Restaurants" },
  { keywords: ["netflix", "spotify", "hulu", "disney+", "hbo", "youtube premium"], category: "Subscriptions" },
  { keywords: ["movie", "cinema", "amc", "concert", "ticketmaster", "steam"], category: "Entertainment" },
  { keywords: ["gym", "fitness", "pharmacy", "cvs", "walgreens", "clinic", "doctor"], category: "Health & Fitness" },
  { keywords: ["amazon", "target", "best buy", "ebay", "etsy"], category: "Shopping" },
  { keywords: ["airline", "delta", "united", "hotel", "airbnb", "expedia"], category: "Travel" },
  { keywords: ["payroll", "salary", "direct deposit", "paycheck"], category: "Income" },
  { keywords: ["transfer", "zelle", "venmo"], category: "Transfers" },
  { keywords: ["fee", "overdraft", "interest charge"], category: "Fees & Charges" },
];

@Injectable()
export class CategorizerService {
  private readonly logger = new Logger(CategorizerService.name);

  constructor(private prisma: PrismaService) {}

  /** Fast, free, deterministic categorization via keyword rules. */
  private ruleMatch(text: string): string | null {
    const lower = text.toLowerCase();
    for (const rule of RULES) {
      if (rule.keywords.some((kw) => lower.includes(kw))) return rule.category;
    }
    return null;
  }

  /**
   * Categorizes a batch of rows for a user. Rows that don't match a keyword
   * rule are sent to Gemini in one batched request (cheap + fast) to guess
   * the closest category from the user's existing category list. Falls back
   * to "Other" if the AI call fails or no key is configured.
   */
  async categorize(
    userId: string,
    rows: { description: string; merchant?: string }[],
  ): Promise<{ categoryId: string | null; aiCategorized: boolean; aiConfidence?: number }[]> {
    const categories = await this.prisma.category.findMany({ where: { userId } });
    const byName = new Map(categories.map((c) => [c.name, c]));
    const other = byName.get("Other");

    const results: { categoryId: string | null; aiCategorized: boolean; aiConfidence?: number }[] = [];
    const aiCandidates: { index: number; text: string }[] = [];

    rows.forEach((row, index) => {
      const text = `${row.merchant ?? ""} ${row.description}`;
      const ruleCategory = this.ruleMatch(text);
      if (ruleCategory && byName.has(ruleCategory)) {
        results[index] = { categoryId: byName.get(ruleCategory)!.id, aiCategorized: false };
      } else {
        results[index] = { categoryId: other?.id ?? null, aiCategorized: false };
        aiCandidates.push({ index, text: text.trim() });
      }
    });

    if (aiCandidates.length > 0 && process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      try {
        const guesses = await this.categorizeWithGemini(
          aiCandidates.map((c) => c.text),
          categories.map((c) => c.name),
        );
        guesses.forEach((guess, i) => {
          const target = aiCandidates[i];
          const cat = guess ? byName.get(guess) : undefined;
          if (cat) {
            results[target.index] = { categoryId: cat.id, aiCategorized: true, aiConfidence: 0.7 };
          }
        });
      } catch (err) {
        this.logger.warn(`Gemini categorization failed, defaulting to "Other": ${(err as Error).message}`);
      }
    }

    return results;
  }

  private async categorizeWithGemini(descriptions: string[], categoryNames: string[]): Promise<(string | null)[]> {
    const model = process.env.AI_MODEL ?? "gemini-2.0-flash";
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const prompt = `You are categorizing bank transactions into these categories: ${categoryNames.join(", ")}.
Given this JSON array of transaction descriptions, return a JSON array of the SAME LENGTH with the best matching
category name for each (must be one of the categories listed, or "Other" if unsure). Return ONLY the JSON array,
no markdown, no explanation.

Transactions: ${JSON.stringify(descriptions)}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
      },
    );

    if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  }
}
