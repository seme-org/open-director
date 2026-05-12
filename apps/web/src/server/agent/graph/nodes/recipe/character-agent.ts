import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { DirectorState } from "../../state";
import { characterOutputSchema } from "@/server/agent/schemas/recipe-parts";
import { characterAgentPrompt } from "../prompts/character";
import { createModel, sendAgentProgress, mergeRecipe, sleep, resolveLanguage, languageInstruction, callStructuredWithRetry } from "./shared";
import { loadAvailableVoices, voicePromptLines } from "@/server/agent/voices";
import type { SSEWriter } from "../../sse-writer";

export async function characterAgentNode(
  state: typeof DirectorState.State,
  config?: { configurable?: { writer?: SSEWriter } },
) {
  const writer = config?.configurable?.writer;
  console.log("[character_agent] starting");
  sendAgentProgress(writer, "character_agent", "running");

  try {
    const recipe = state.recipe || {};
    const r = recipe as Record<string, unknown>;
    const lang = resolveLanguage(state.directorBrief as Record<string, unknown> | undefined, r.language as string | undefined);
    const scenes = r.scenes as Array<Record<string, unknown>> | undefined;
    const requiredEntities = scenes
      ?.flatMap((s) => (s.shots as Array<Record<string, unknown>> || [])
        .flatMap((shot) => shot.characters as string[] || []))
      .filter(Boolean) ?? [];

    const voiceCatalog = await loadAvailableVoices(state.userId);

    const llm = createModel().withStructuredOutput(characterOutputSchema, {
      name: "generate_characters",
    });

    const context = `Full Story: ${r.fullStory || "N/A"}
Art Style: ${r.artStyle ? JSON.stringify(r.artStyle) : "N/A"}
Required Entities from storyboard: ${[...new Set(requiredEntities)].join(", ") || "none"}
User brief: ${state.goal}

Available Voices (you MUST assign a DIFFERENT voiceId to each character, choose based on character personality and gender):
${voicePromptLines(voiceCatalog)}`;

    const partial = await callStructuredWithRetry(
      llm as unknown as Parameters<typeof callStructuredWithRetry>[0],
      [new SystemMessage(characterAgentPrompt("story") + languageInstruction(lang)), new HumanMessage(context)],
      "character_agent",
      writer,
      (chunk) => writer?.write("recipe", mergeRecipe(recipe, chunk as Record<string, unknown>)),
    );

    const updated = mergeRecipe(recipe, partial as Record<string, unknown>);
    const chars = (updated as Record<string, unknown>).characters as unknown[] | undefined;
    console.log("[character_agent] completed, characters:", chars?.length ?? 0);
    sendAgentProgress(writer, "character_agent", "completed");
    await sleep(80);

    return { recipe: updated, currentStep: "character_agent" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[character_agent] failed:", message);
    sendAgentProgress(writer, "character_agent", "failed");
    return { error: message, currentStep: "error" };
  }
}
