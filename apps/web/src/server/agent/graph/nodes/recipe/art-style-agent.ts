import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { DirectorState } from "../../state";
import { artStyleOutputSchema } from "@/server/agent/schemas/recipe-parts";
import { artStyleAgentPrompt } from "../prompts/art-style";
import { loadPublicArtStyles } from "@/server/agent/art-styles";
import { createModel, sendAgentProgress, mergeRecipe, sleep, resolveLanguage, languageInstruction, callStructuredWithRetry } from "./shared";
import type { SSEWriter } from "../../sse-writer";

export async function artStyleAgentNode(
  state: typeof DirectorState.State,
  config?: { configurable?: { writer?: SSEWriter } },
) {
  const writer = config?.configurable?.writer;
  console.log("[art_style_agent] starting");
  sendAgentProgress(writer, "art_style_agent", "running");

  try {
    const artStyleCatalog = await loadPublicArtStyles();
    const recipe = state.recipe || {};
    const r = recipe as Record<string, unknown>;
    const brief = (state.directorBrief || {}) as Record<string, unknown>;

    let selectedStyle = "";
    const exam = brief.exam as Record<string, unknown> | undefined;
    const singleChoices = Array.isArray(exam?.single_choice) ? exam.single_choice : [];
    const artStyleChoice = singleChoices.find((c: any) => c.key === "art_style");
    if (artStyleChoice) {
      const options = Array.isArray(artStyleChoice.options) ? artStyleChoice.options : [];
      const selected = options.find((o: any) => Number(o.default) === 1);
      selectedStyle = selected?.value || options[0]?.value || "";
    }

    console.log("[art_style_agent] directorBrief.art_style:", selectedStyle || "(not set)");
    const lang = resolveLanguage(brief, r.language as string | undefined);

    const llm = createModel().withStructuredOutput(artStyleOutputSchema, {
      name: "generate_art_style",
    });

    const context = `Full Story: ${r.fullStory || "N/A"}
User brief: ${state.goal}
${selectedStyle ? `IMPORTANT: User selected art style "${selectedStyle}". You MUST use this exact style from the catalog.` : ""}`;

    const partial = await callStructuredWithRetry(
      llm as unknown as Parameters<typeof callStructuredWithRetry>[0],
      [new SystemMessage(artStyleAgentPrompt("story", artStyleCatalog) + languageInstruction(lang)), new HumanMessage(context)],
      "art_style_agent",
      writer,
      (chunk) => writer?.write("recipe", mergeRecipe(recipe, chunk as Record<string, unknown>)),
    );

    const updated = mergeRecipe(recipe, partial as Record<string, unknown>);
    console.log("[art_style_agent] completed, style:", (updated as Record<string, unknown>).artStyle ? ((updated as Record<string, unknown>).artStyle as Record<string, unknown>).name : "unknown");
    sendAgentProgress(writer, "art_style_agent", "completed");
    await sleep(80);

    return { recipe: updated, currentStep: "art_style_agent" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[art_style_agent] failed:", message);
    sendAgentProgress(writer, "art_style_agent", "failed");
    return { error: message, currentStep: "error" };
  }
}
