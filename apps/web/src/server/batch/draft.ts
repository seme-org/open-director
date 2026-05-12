import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

export type BatchDraftItemInput = {
  subject: string;
  script?: string;
  terms?: string[];
};

export type BatchDraftItem = {
  subject: string;
  script: string;
  terms: string[];
};

export function parseGeneratedTerms(text: string) {
  return text
    .split(/\r?\n|[,，]/)
    .map((term) => term.replace(/^\s*\d+[.)、-]?\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

export function buildBatchScriptPrompt(input: { subject: string; language: string; paragraphCount: number }) {
  const langHint = input.language && input.language !== "auto"
    ? `Write in ${input.language}.`
    : "Auto-detect language from the subject.";
  return [
    `Video subject: ${input.subject}`,
    `Language: ${langHint}`,
    `Paragraph count: ${input.paragraphCount}`,
    "",
    "Write a short-video voiceover script.",
    "Style: vivid, conversational, story-driven. Hook the viewer in the first sentence.",
    "Use natural spoken phrasing — smooth, colloquial, not stiff or translated.",
    "Focus on high-level narrative actions and emotional beats. Avoid camera directions or stage instructions.",
    "Use clear sentence punctuation so subtitle splitting works well.",
    "Return only the spoken script, no markdown, title, labels, or bullets.",
  ].join("\n");
}

export function buildBatchTermsPrompt(input: { subject: string; script: string; amount: number; language: string }) {
  const langHint = input.language && input.language !== "auto"
    ? `Generate keywords in ${input.language}.`
    : "Generate keywords in the same language as the script.";
  return [
    `Video subject: ${input.subject}`,
    `Video script: ${input.script}`,
    `Generate ${input.amount} concise stock-video search keywords.`,
    langHint,
    "Return one keyword phrase per line. No numbering if possible.",
  ].join("\n");
}

function openaiModel() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for AI batch draft generation.");
  return new ChatOpenAI({
    modelName: process.env.BATCH_DRAFT_MODEL || process.env.BATCH_SCRIPT_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
    openAIApiKey: apiKey,
    configuration: { baseURL: process.env.OPENAI_BASE_URL },
  });
}

async function generateScript(input: { subject: string; language: string; tone: string; audience: string; paragraphCount: number }) {
  const model = openaiModel();

  const result = await model.invoke([
    new SystemMessage("You write concise short-video voiceover scripts for batch video production."),
    new HumanMessage(buildBatchScriptPrompt(input)),
  ]);
  return (result.content as string).trim();
}

async function generateTerms(input: { subject: string; script: string; amount: number; language: string }) {
  const model = openaiModel();

  const result = await model.invoke([
    new SystemMessage("You generate visual stock-video search keywords. Return only keyword phrases."),
    new HumanMessage(buildBatchTermsPrompt(input)),
  ]);
  return parseGeneratedTerms(result.content as string).slice(0, input.amount);
}

export async function generateBatchDraftScripts(input: {
  items: BatchDraftItemInput[];
  language: string;
  tone: string;
  audience: string;
  paragraphCount: number;
  termAmount?: number;
}) {
  const termAmount = input.termAmount ?? 5;
  const drafts: BatchDraftItem[] = [];

  for (const item of input.items) {
    const subject = item.subject.trim();
    const script =
      item.script?.trim() ||
      (await generateScript({
        subject,
        language: input.language,
        tone: input.tone,
        audience: input.audience,
        paragraphCount: input.paragraphCount,
      }));
    const terms = item.terms?.length ? item.terms : await generateTerms({ subject, script, amount: termAmount, language: input.language });
    drafts.push({ subject, script, terms });
  }

  return drafts;
}

export async function generateBatchDraftTerms(input: {
  items: BatchDraftItemInput[];
  language?: string;
  termAmount?: number;
}) {
  const termAmount = input.termAmount ?? 5;
  const language = input.language || "";
  const drafts: BatchDraftItem[] = [];

  for (const item of input.items) {
    const subject = item.subject.trim();
    const script = item.script?.trim() || subject;
    const terms = await generateTerms({ subject, script, amount: termAmount, language });
    drafts.push({ subject, script, terms });
  }

  return drafts;
}
