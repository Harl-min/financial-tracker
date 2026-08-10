import { Injectable, Logger } from "@nestjs/common";
import { parse } from "csv-parse/sync";

export interface ParsedRow {
  description: string;
  merchant?: string;
  amount: number; // positive number, sign implied by `type`
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  occurredAt: Date;
  rawDescription: string;
}

const DATE_KEYS = ["date", "transaction date", "posted date", "posting date"];
const DESC_KEYS = ["description", "details", "memo", "narrative", "payee"];
const AMOUNT_KEYS = ["amount", "value"];
const DEBIT_KEYS = ["debit", "withdrawal", "money out"];
const CREDIT_KEYS = ["credit", "deposit", "money in"];

function normalizeKey(k: string) {
  return k.trim().toLowerCase();
}

function findKey(headers: string[], candidates: string[]) {
  return headers.find((h) => candidates.includes(normalizeKey(h)));
}

function parseAmount(raw: string): number {
  return Number(raw.replace(/[^0-9.-]+/g, "")) || 0;
}

@Injectable()
export class StatementParserService {
  private readonly logger = new Logger(StatementParserService.name);

  /**
   * Parses a CSV bank statement export. Handles both:
   *  - a single signed "amount" column (negative = expense)
   *  - separate debit/credit columns
   * Column names are matched case-insensitively against common bank export
   * headers (Chase, Amex, Bank of America, Revolut, Monzo, etc. all use some
   * variant of these).
   */
  parseCsv(buffer: Buffer): ParsedRow[] {
    const records: Record<string, string>[] = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    if (records.length === 0) return [];

    const headers = Object.keys(records[0]);
    const dateKey = findKey(headers, DATE_KEYS);
    const descKey = findKey(headers, DESC_KEYS);
    const amountKey = findKey(headers, AMOUNT_KEYS);
    const debitKey = findKey(headers, DEBIT_KEYS);
    const creditKey = findKey(headers, CREDIT_KEYS);

    if (!dateKey || !descKey || (!amountKey && !debitKey && !creditKey)) {
      throw new Error(
        `Could not detect required columns in CSV. Found headers: ${headers.join(", ")}`,
      );
    }

    const rows: ParsedRow[] = [];

    for (const record of records) {
      const occurredAt = new Date(record[dateKey]);
      if (isNaN(occurredAt.getTime())) continue;

      const description = record[descKey]?.trim() || "Unknown transaction";
      let amount = 0;
      let type: ParsedRow["type"] = "EXPENSE";

      if (amountKey) {
        const signed = parseAmount(record[amountKey]);
        amount = Math.abs(signed);
        type = signed < 0 ? "EXPENSE" : "INCOME";
      } else {
        const debit = debitKey ? parseAmount(record[debitKey]) : 0;
        const credit = creditKey ? parseAmount(record[creditKey]) : 0;
        if (debit > 0) {
          amount = debit;
          type = "EXPENSE";
        } else {
          amount = credit;
          type = "INCOME";
        }
      }

      if (/transfer/i.test(description)) type = "TRANSFER";

      rows.push({
        description,
        merchant: guessMerchant(description),
        amount,
        type,
        occurredAt,
        rawDescription: JSON.stringify(record),
      });
    }

    return rows;
  }

  /**
   * Best-effort line-based extraction for PDF statements. This is a starting
   * point, not a full OCR pipeline: it assumes each transaction sits on its
   * own line as `DATE  DESCRIPTION  AMOUNT`. For scanned/image-only PDFs,
   * wire in an OCR step (e.g. Google Vision, Tesseract, or a Gemini vision
   * call) before this and feed it the extracted text.
   */
  parsePdfText(text: string): ParsedRow[] {
    const lineRegex =
      /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+(.+?)\s+([-+]?\$?\d[\d,]*\.\d{2})\s*$/;
    const rows: ParsedRow[] = [];

    for (const line of text.split("\n")) {
      const match = line.trim().match(lineRegex);
      if (!match) continue;
      const [, dateStr, description, amountStr] = match;
      const occurredAt = new Date(dateStr);
      if (isNaN(occurredAt.getTime())) continue;

      const signed = parseAmount(amountStr);
      rows.push({
        description: description.trim(),
        merchant: guessMerchant(description),
        amount: Math.abs(signed),
        type: signed < 0 ? "EXPENSE" : "INCOME",
        occurredAt,
        rawDescription: line.trim(),
      });
    }

    if (rows.length === 0) {
      this.logger.warn("No transaction lines matched in PDF text — statement may need OCR.");
    }

    return rows;
  }
}

function guessMerchant(description: string): string {
  return description
    .replace(/\s{2,}/g, " ")
    .replace(/#\d+/g, "")
    .replace(/\d{4,}/g, "")
    .trim()
    .split(" ")
    .slice(0, 3)
    .join(" ");
}
