import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { DirectorState } from "../../state";
import { bgmOutputSchema } from "@/server/agent/schemas/recipe-parts";
import { bgmAgentPrompt } from "../prompts/bgm";
import { createModel, sendAgentProgress, mergeRecipe, sleep, resolveLanguage, languageInstruction, callStructuredWithRetry } from "./shared";
import type { SSEWriter } from "../../sse-writer";

export async function bgmAgentNode(
  state: typeof DirectorState.State,
  config?: { configurable?: { writer?: SSEWriter } },
) {
  const writer = config?.configurable?.writer;
  console.log("[bgm_agent] starting");
  sendAgentProgress(writer, "bgm_agent", "running");

  try {
    const recipe = state.recipe || {};
    const r = recipe as Record<string, unknown>;
    const lang = resolveLanguage(state.directorBrief as Record<string, unknown> | undefined, r.language as string | undefined);
    const scenes = r.scenes as Array<Record<string, unknown>> | undefined;
    const totalDuration = scenes?.reduce((sum, s) => sum + ((s.duration as number) || 0), 0) || 60;

    const llm = createModel().withStructuredOutput(bgmOutputSchema, {
      name: "generate_bgm",
    });

    const context = `Full Story: ${r.fullStory || "N/A"}
Art Style: ${r.artStyle ? JSON.stringify(r.artStyle) : "N/A"}
Total video duration: ${totalDuration} seconds`;

    const partial = await callStructuredWithRetry(
      llm as unknown as Parameters<typeof callStructuredWithRetry>[0],
      [new SystemMessage(bgmAgentPrompt("story") + languageInstruction(lang)), new HumanMessage(context)],
      "bgm_agent",
      writer,
      (chunk) => writer?.write("recipe", mergeRecipe(recipe, chunk as Record<string, unknown>)),
    );

    const updated = mergeRecipe(recipe, partial as Record<string, unknown>);
    console.log("[bgm_agent] completed");
    sendAgentProgress(writer, "bgm_agent", "completed");
    await sleep(80);

    return { recipe: updated, currentStep: "bgm_agent" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[bgm_agent] failed:", message);
    sendAgentProgress(writer, "bgm_agent", "failed");
    return { error: message, currentStep: "error" };
  }
}
