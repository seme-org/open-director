import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { DirectorState } from "../../state";
import { mediaOutputSchema } from "@/server/agent/schemas/recipe-parts";
import { mediaAgentPrompt } from "../prompts/media";
import { createModel, sendAgentProgress, mergeRecipe, sleep, resolveLanguage, languageInstruction, callStructuredWithRetry } from "./shared";
import { persistDirectorWorkflow } from "@/server/agent/utils/recipe-persist";
import type { DirectorRecipe } from "@/server/agent/schemas/recipe";
import type { SSEWriter } from "../../sse-writer";

export async function mediaAgentNode(
  state: typeof DirectorState.State,
  config?: { configurable?: { writer?: SSEWriter } },
) {
  const writer = config?.configurable?.writer;
  console.log("[media_agent] starting");
  sendAgentProgress(writer, "media_agent", "running");

  try {
    const recipe = state.recipe || {};
    const r = recipe as Record<string, unknown>;
    const lang = resolveLanguage(state.directorBrief as Record<string, unknown> | undefined, r.language as string | undefined);
    const scenes = r.scenes as Array<Record<string, unknown>> | undefined;
    const characters = r.characters as Array<Record<string, unknown>> | undefined;
    const locations = r.locations as Array<Record<string, unknown>> | undefined;
    const artStyle = r.artStyle as Record<string, unknown> | undefined;

    const shotsContext = scenes?.flatMap((s) =>
      (s.shots as Array<Record<string, unknown>> || []).map((shot) => ({
        shotId: shot.shotId,
        sceneTitle: s.title,
        description: shot.description,
        characters: shot.characters,
        visualElements: shot.visualElements,
      })),
    ) || [];

    const llm = createModel().withStructuredOutput(mediaOutputSchema, {
      name: "generate_media",
    });

    const context = `Shots: ${JSON.stringify(shotsContext, null, 2)}
Characters: ${JSON.stringify(characters?.map((c) => ({ name: c.name, promptText: c.promptText })), null, 2)}
Locations: ${JSON.stringify(locations?.map((l) => ({ name: l.name, promptText: l.promptText })), null, 2)}
Art Style promptPrefix: ${artStyle?.promptPrefix || "N/A"}`;

    const partial = await callStructuredWithRetry(
      llm as unknown as Parameters<typeof callStructuredWithRetry>[0],
      [new SystemMessage(mediaAgentPrompt("story") + languageInstruction(lang)), new HumanMessage(context)],
      "media_agent",
      writer,
      (chunk) => writer?.write("recipe", mergeRecipe(recipe, chunk as Record<string, unknown>)),
    );

    const updated = mergeRecipe(recipe, partial as Record<string, unknown>);
    const shots = (updated as Record<string, unknown>).media ? ((updated as Record<string, unknown>).media as Record<string, unknown>).shots as unknown[] | undefined : undefined;
    console.log("[media_agent] completed, shots:", shots?.length ?? 0);

    try {
      const result = await persistDirectorWorkflow({
        threadId: state.threadId,
        userId: state.userId,
        prompt: state.goal,
        recipe: updated as DirectorRecipe,
      });
      writer?.write("recipe", { ...updated, recipeId: result.recipeId });
      console.log("[media_agent] persisted recipe:", result.recipeId);
      sendAgentProgress(writer, "media_agent", "completed", { recipeId: result.recipeId });
      await sleep(80);
      return { recipe: updated, recipeId: result.recipeId, currentStep: "media_agent" };
    } catch (err) {
      console.error("[media_agent] persist failed:", err);
      sendAgentProgress(writer, "media_agent", "completed");
      await sleep(80);
      return { recipe: updated, currentStep: "media_agent" };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[media_agent] failed:", message);
    sendAgentProgress(writer, "media_agent", "failed");
    return { error: message, currentStep: "error" };
  }
}
