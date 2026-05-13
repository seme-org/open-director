import type { DirectorState } from "../../state";
import type { ResearchNotes, ResearchSource } from "@/server/agent/schemas/research";
import { sendAgentProgress } from "./shared";
import type { SSEWriter } from "../../sse-writer";

const CHINESE_REFERENCE_PATTERNS = [
  /孔融让梨/,
  /草船借箭/,
  /小马过河/,
  /成语/,
  /典故/,
  /寓言/,
  /神话/,
  /传说/,
  /历史/,
  /真实/,
  /新闻/,
  /名人/,
  /人物/,
  /品牌/,
  /产品/,
  /公司/,
  /课程/,
  /科普/,
  /知识点/,
  /改编自/,
  /根据/,
  /基于/,
];

const ENGLISH_REFERENCE_PATTERNS = [
  /\btortoise and the hare\b/i,
  /\bfable\b/i,
  /\bfolktale\b/i,
  /\bmyth\b/i,
  /\blegend\b/i,
  /\bhistorical\b/i,
  /\bhistory\b/i,
  /\btrue story\b/i,
  /\bnews\b/i,
  /\bbiography\b/i,
  /\bfamous person\b/i,
  /\bbrand\b/i,
  /\bproduct\b/i,
  /\bcompany\b/i,
  /\bcourse\b/i,
  /\blesson\b/i,
  /\bscience\b/i,
  /\bbased on\b/i,
  /\badapted from\b/i,
];

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function compactLines(values: unknown[], limit = 8) {
  return values
    .map((value) => textValue(value))
    .filter(Boolean)
    .slice(0, limit);
}

export function shouldResearchForGoal(goal: string, directorBrief?: Record<string, unknown>) {
  const briefText = [
    textValue(directorBrief?.project_name),
    textValue(directorBrief?.story),
    textValue(directorBrief?.summary),
    textValue(directorBrief?.intent),
  ].filter(Boolean).join(" ");
  const text = `${goal || ""} ${briefText}`;
  return [...CHINESE_REFERENCE_PATTERNS, ...ENGLISH_REFERENCE_PATTERNS].some((pattern) => pattern.test(text));
}

export function buildResearchQuery(goal: string, directorBrief?: Record<string, unknown>) {
  const projectName = textValue(directorBrief?.project_name);
  const base = projectName && !goal.includes(projectName) ? `${projectName} ${goal}` : goal;
  const hasChinese = /[\u3400-\u9fff]/.test(base);
  return hasChinese
    ? `${base} 故事 梗概 核心寓意 主要人物`
    : `${base} story summary core facts main characters`;
}

function parseJsonObject(text: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined;
  } catch {}

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return undefined;
  try {
    const parsed = JSON.parse(match[0]);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined;
  } catch {
    return undefined;
  }
}

export function parseResearchResponseText(text: string, query: string): ResearchNotes {
  const parsed = parseJsonObject(text);
  if (parsed) {
    const sourceCandidates = Array.isArray(parsed.sources) ? parsed.sources : [];
    const sources = sourceCandidates
      .map((source): ResearchSource | undefined => {
        if (!source || typeof source !== "object") return undefined;
        const record = source as Record<string, unknown>;
        const url = textValue(record.url);
        if (!url) return undefined;
        const title = textValue(record.title);
        return title ? { title, url } : { url };
      })
      .filter((source): source is ResearchSource => Boolean(source))
      .slice(0, 6);

    return {
      shouldResearch: true,
      query,
      notes: compactLines(Array.isArray(parsed.notes) ? parsed.notes : []),
      cautions: compactLines(Array.isArray(parsed.cautions) ? parsed.cautions : [], 4),
      sources,
    };
  }

  return {
    shouldResearch: true,
    query,
    notes: text.split(/\n+/).map((line) => line.replace(/^[-*]\s*/, "").trim()).filter(Boolean).slice(0, 8),
    cautions: [],
    sources: [],
  };
}

function extractOutputText(response: Record<string, unknown>) {
  const outputText = textValue(response.output_text);
  if (outputText) return outputText;

  const chunks: string[] = [];
  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? (item as Record<string, unknown>).content as Array<Record<string, unknown>>
      : [];
    for (const part of content) {
      const text = textValue(part.text);
      if (text) chunks.push(text);
    }
  }
  return chunks.join("\n").trim();
}

function collectSources(value: unknown, sources: ResearchSource[] = []) {
  if (!value || typeof value !== "object") return sources;
  if (Array.isArray(value)) {
    for (const item of value) collectSources(item, sources);
    return sources;
  }

  const record = value as Record<string, unknown>;
  const url = textValue(record.url);
  if (url) {
    const title = textValue(record.title);
    sources.push(title ? { title, url } : { url });
  }

  for (const nested of Object.values(record)) {
    if (nested && typeof nested === "object") collectSources(nested, sources);
  }
  return sources;
}

function mergeSources(...groups: Array<ResearchSource[] | undefined>) {
  const seen = new Set<string>();
  const sources: ResearchSource[] = [];
  for (const group of groups) {
    for (const source of group ?? []) {
      if (!source.url || seen.has(source.url)) continue;
      seen.add(source.url);
      sources.push(source);
      if (sources.length >= 8) return sources;
    }
  }
  return sources;
}

async function fetchOpenAIWebSearch(query: string, goal: string): Promise<ResearchNotes> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const baseURL = (process.env.OPENAI_RESPONSES_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(`${baseURL}/responses`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        tools: [{ type: "web_search_preview" }],
        tool_choice: "required",
        include: ["web_search_call.action.sources"],
        input: [
          "You are OpenDirector's research_agent.",
          "Search the web only to verify source material, factual references, and known story structure.",
          "Return JSON only with this shape:",
          "{\"notes\":[\"short factual note\"],\"cautions\":[\"short caution\"],\"sources\":[{\"title\":\"source title\",\"url\":\"https://...\"}]}",
          "Keep notes concise. Do not copy long passages. Prefer stable encyclopedic or primary sources when possible.",
          `User goal: ${goal}`,
          `Search query: ${query}`,
        ].join("\n"),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`OpenAI web search failed: ${response.status} ${await response.text()}`);
    }

    const data = await response.json() as Record<string, unknown>;
    const text = extractOutputText(data);
    if (!text) throw new Error("OpenAI web search returned no output text.");
    const parsed = parseResearchResponseText(text, query);
    return {
      ...parsed,
      sources: mergeSources(parsed.sources, collectSources(data)),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function formatResearchNotesForScript(research: ResearchNotes | undefined) {
  if (!research?.shouldResearch) return "";
  const notes = research.notes?.length ? research.notes.map((note) => `- ${note}`).join("\n") : "- No reliable notes were found.";
  const cautions = research.cautions?.length
    ? `\nCautions:\n${research.cautions.map((caution) => `- ${caution}`).join("\n")}`
    : "";
  return [
    "Reference notes from research_agent:",
    notes,
    cautions,
    "Use these notes only to preserve core facts/structure. User instructions still take priority. Do not quote or copy source text.",
  ].filter(Boolean).join("\n");
}

export async function researchAgentNode(
  state: typeof DirectorState.State,
  config?: { configurable?: { writer?: SSEWriter } },
) {
  const writer = config?.configurable?.writer;
  const directorBrief = state.directorBrief as Record<string, unknown> | undefined;
  const goal = state.goal || "";

  console.log("[research_agent] starting, goal:", goal.slice(0, 80));
  sendAgentProgress(writer, "research_agent", "running");

  const shouldResearch = shouldResearchForGoal(goal, directorBrief);
  if (!shouldResearch) {
    const research: ResearchNotes = { shouldResearch: false, notes: [], cautions: [], sources: [] };
    sendAgentProgress(writer, "research_agent", "completed", { skipped: true });
    return { research, currentStep: "research_agent" };
  }

  const query = buildResearchQuery(goal, directorBrief);
  try {
    const research = await fetchOpenAIWebSearch(query, goal);
    writer?.write("agent-status", {
      node: "research_agent",
      status: "completed",
      query,
      noteCount: research.notes.length,
    });
    return { research, currentStep: "research_agent" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[research_agent] continuing without research:", message);
    const research: ResearchNotes = {
      shouldResearch: true,
      query,
      notes: [],
      cautions: ["Research was requested but unavailable; preserve only well-known or user-provided facts."],
      sources: [],
      error: message,
    };
    sendAgentProgress(writer, "research_agent", "completed", { warning: message });
    return { research, currentStep: "research_agent" };
  }
}
