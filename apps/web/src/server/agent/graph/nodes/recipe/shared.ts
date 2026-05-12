import { ChatOpenAI } from "@langchain/openai";
import type { DirectorRecipe } from "@/server/agent/schemas/recipe";
import type { SSEWriter } from "../../sse-writer";

export function createModel() {
  return new ChatOpenAI({
    modelName: process.env.OPENAI_MODEL || "gpt-4o-mini",
    openAIApiKey: process.env.OPENAI_API_KEY || "missing-key",
    configuration: { baseURL: process.env.OPENAI_BASE_URL },
    streaming: true,
  });
}

export function sendAgentProgress(
  writer: SSEWriter | undefined,
  agentName: string,
  status: "running" | "completed" | "failed",
  extra?: Record<string, unknown>,
) {
  writer?.write("agent-status", { node: agentName, status, ...extra });
}

export function mergeRecipe(
  base: Partial<DirectorRecipe>,
  patch: Record<string, unknown>,
): Partial<DirectorRecipe> {
  return { ...base, ...patch };
}

export function sendRecipeProgress(
  writer: SSEWriter | undefined,
  recipe: Partial<DirectorRecipe>,
  section: "subjects" | "scenes" | "complete",
) {
  writer?.write("recipe", { ...recipe, _section: section });
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const LANGUAGE_LABELS: Record<string, string> = {
  "zh-CN": "Chinese (中文)",
  "en": "English",
  "ja": "Japanese (日本語)",
  "ko": "Korean (한국어)",
  "es": "Spanish (Español)",
  "fr": "French (Français)",
  "de": "German (Deutsch)",
  "pt": "Portuguese (Português)",
  "it": "Italian (Italiano)",
  "ru": "Russian (Русский)",
  "ar": "Arabic (العربية)",
  "hi": "Hindi (हिन्दी)",
};

export function resolveLanguage(
  directorBrief: Record<string, unknown> | undefined,
  recipeLanguage: string | undefined,
): string | undefined {
  // 1. Check recipe.language (set by script_agent)
  if (recipeLanguage) return recipeLanguage;

  // 2. Check directorBrief.language (direct field from draft schema)
  const briefLang = directorBrief?.language;
  if (typeof briefLang === "string" && LANGUAGE_LABELS[briefLang]) return briefLang;

  // 3. Check directorBrief.exam.single_choice for language selection
  const exam = directorBrief?.exam as Record<string, unknown> | undefined;
  const singleChoice = exam?.single_choice as Array<Record<string, unknown>> | undefined;
  if (singleChoice) {
    const langChoice = singleChoice.find((c) => c.key === "language");
    if (langChoice) {
      const options = langChoice.options as Array<Record<string, unknown>> | undefined;
      const selected = options?.find((o) => Number(o.default) === 1);
      if (selected?.value && LANGUAGE_LABELS[String(selected.value)]) {
        return String(selected.value);
      }
    }
  }

  return undefined;
}

export function languageInstruction(langCode: string | undefined): string {
  if (!langCode) return "";
  const label = LANGUAGE_LABELS[langCode] || langCode;
  return `\n\nIMPORTANT LANGUAGE: Generate ALL text content (titles, summaries, stories, descriptions, dialogue, prompts, names) in ${label} (language code: ${langCode}). Do NOT use English unless the language is English.`;
}

const MAX_RETRIES = 3;
const LLM_TIMEOUT_MS = 120_000; // 2 minutes

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`[${label}] timed out after ${ms}ms`)), ms);
    }),
  ]);
}

export async function callStructuredWithRetry<T>(
  llm: { stream: (messages: unknown[]) => AsyncIterable<T> },
  messages: unknown[],
  agentName: string,
  writer?: SSEWriter,
  onChunk?: (partial: Partial<T>) => void,
): Promise<Partial<T>> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const stream = await llm.stream(messages);
      const result = await withTimeout((async () => {
        let partial: Partial<T> | undefined;
        for await (const chunk of stream) {
          partial = { ...partial, ...chunk } as Partial<T>;
          onChunk?.(partial);
        }
        if (!partial) throw new Error("Empty LLM response");
        return partial;
      })(), LLM_TIMEOUT_MS, agentName);
      return result;
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[${agentName}] attempt ${attempt}/${MAX_RETRIES} failed:`, msg);
      if (attempt < MAX_RETRIES) {
        writer?.write("agent-status", { node: agentName, status: "running", retry: attempt + 1 });
        await sleep(1000 * attempt);
      }
    }
  }
  throw lastError;
}
