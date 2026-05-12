export type ParsedBatchItem = {
  order: number;
  subject: string;
  script: string;
  terms: string[];
};

type RawBatchItem = {
  subject?: unknown;
  script?: unknown;
  terms?: unknown;
};

function splitTerms(value: string) {
  return value
    .split(/[,，]/)
    .map((term) => term.trim())
    .filter(Boolean);
}

function normalizeTerms(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((term) => String(term).trim()).filter(Boolean);
  }

  return splitTerms(String(value || ""));
}

export function parseBatchLines(text: string): ParsedBatchItem[] {
  const rows = text
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), originalLine: index + 1 }))
    .filter((row) => row.line.length > 0);

  return rows.map((row, index) => {
    const parts = row.line.split("|").map((part) => part.trim());
    const subject = parts[0] ?? "";
    const script = parts[1] ?? "";
    const terms = splitTerms(parts[2] ?? "");

    if (!subject && !script) {
      throw new Error(`Line ${row.originalLine} must include a subject or script.`);
    }

    return {
      order: index + 1,
      subject,
      script,
      terms,
    };
  });
}

export function parseBatchItems(items: RawBatchItem[]): ParsedBatchItem[] {
  return items.map((item, index) => {
    const subject = String(item.subject || "").trim();
    const script = String(item.script || "").trim();
    const terms = normalizeTerms(item.terms);

    if (!subject && !script) {
      throw new Error(`Item ${index + 1} must include a subject or script.`);
    }

    return {
      order: index + 1,
      subject,
      script,
      terms,
    };
  });
}
