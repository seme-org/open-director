import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { DirectorState } from "../../state";
import { storyboardOutputSchema } from "@/server/agent/schemas/recipe-parts";
import { storyboardAgentPrompt } from "../prompts/storyboard";
import { createModel, sendAgentProgress, mergeRecipe, sleep, resolveLanguage, languageInstruction, callStructuredWithRetry } from "./shared";
import type { SSEWriter } from "../../sse-writer";

export async function storyboardAgentNode(
  state: typeof DirectorState.State,
  config?: { configurable?: { writer?: SSEWriter } },
) {
  const writer = config?.configurable?.writer;
  console.log("[storyboard_agent] starting");
  sendAgentProgress(writer, "storyboard_agent", "running");

  try {
    const recipe = state.recipe || {};
    const r = recipe as Record<string, unknown>;
    const lang = resolveLanguage(state.directorBrief as Record<string, unknown> | undefined, r.language as string | undefined);

    const llm = createModel().withStructuredOutput(storyboardOutputSchema, {
      name: "generate_storyboard",
    });

    const context = `Full Story: ${r.fullStory || "N/A"}
Art Style: ${r.artStyle ? JSON.stringify(r.artStyle) : "N/A"}
User brief: ${state.goal}`;

    const partial = await callStructuredWithRetry(
      llm as unknown as Parameters<typeof callStructuredWithRetry>[0],
      [new SystemMessage(storyboardAgentPrompt("story") + languageInstruction(lang)), new HumanMessage(context)],
      "storyboard_agent",
      writer,
      (chunk) => writer?.write("recipe", mergeRecipe(recipe, chunk as Record<string, unknown>)),
    );

    const updated = mergeRecipe(recipe, partial as Record<string, unknown>);
    const scenes = (updated as Record<string, unknown>).scenes as unknown[] | undefined;
    console.log("[storyboard_agent] completed, scenes:", scenes?.length ?? 0);
    sendAgentProgress(writer, "storyboard_agent", "completed");
    await sleep(80);

    return { recipe: updated, currentStep: "storyboard_agent" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[storyboard_agent] failed:", message);
    sendAgentProgress(writer, "storyboard_agent", "failed");
    return { error: message, currentStep: "error" };
  }
}
