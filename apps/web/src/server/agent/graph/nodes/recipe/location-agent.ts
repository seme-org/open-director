import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { DirectorState } from "../../state";
import { locationOutputSchema } from "@/server/agent/schemas/recipe-parts";
import { locationAgentPrompt } from "../prompts/location";
import { createModel, sendAgentProgress, mergeRecipe, sleep, resolveLanguage, languageInstruction, callStructuredWithRetry } from "./shared";
import type { SSEWriter } from "../../sse-writer";

export async function locationAgentNode(
  state: typeof DirectorState.State,
  config?: { configurable?: { writer?: SSEWriter } },
) {
  const writer = config?.configurable?.writer;
  console.log("[location_agent] starting");
  sendAgentProgress(writer, "location_agent", "running");

  try {
    const recipe = state.recipe || {};
    const r = recipe as Record<string, unknown>;
    const lang = resolveLanguage(state.directorBrief as Record<string, unknown> | undefined, r.language as string | undefined);

    const llm = createModel().withStructuredOutput(locationOutputSchema, {
      name: "generate_locations",
    });

    const context = `Full Story: ${r.fullStory || "N/A"}
Art Style: ${r.artStyle ? JSON.stringify(r.artStyle) : "N/A"}
User brief: ${state.goal}`;

    const partial = await callStructuredWithRetry(
      llm as unknown as Parameters<typeof callStructuredWithRetry>[0],
      [new SystemMessage(locationAgentPrompt("story") + languageInstruction(lang)), new HumanMessage(context)],
      "location_agent",
      writer,
      (chunk) => writer?.write("recipe", mergeRecipe(recipe, chunk as Record<string, unknown>)),
    );

    const updated = mergeRecipe(recipe, partial as Record<string, unknown>);
    const locs = (updated as Record<string, unknown>).locations as unknown[] | undefined;
    console.log("[location_agent] completed, locations:", locs?.length ?? 0);
    sendAgentProgress(writer, "location_agent", "completed");
    await sleep(80);

    return { recipe: updated, currentStep: "location_agent" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[location_agent] failed:", message);
    sendAgentProgress(writer, "location_agent", "failed");
    return { error: message, currentStep: "error" };
  }
}
