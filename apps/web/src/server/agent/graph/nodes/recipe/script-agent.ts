import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { DirectorState } from "../../state";
import { scriptOutputSchema } from "@/server/agent/schemas/recipe-parts";
import { scriptAgentPrompt } from "../prompts/script";
import { createModel, sendAgentProgress, mergeRecipe, sleep, resolveLanguage, languageInstruction, callStructuredWithRetry } from "./shared";
import type { SSEWriter } from "../../sse-writer";

export async function scriptAgentNode(
  state: typeof DirectorState.State,
  config?: { configurable?: { writer?: SSEWriter } },
) {
  const writer = config?.configurable?.writer;
  console.log("[script_agent] starting, goal:", state.goal?.slice(0, 80));
  sendAgentProgress(writer, "script_agent", "running");

  try {
    const lang = resolveLanguage(state.directorBrief as Record<string, unknown> | undefined, undefined);
    const llm = createModel().withStructuredOutput(scriptOutputSchema, {
      name: "generate_script",
    });

    const partial = await callStructuredWithRetry(
      llm as unknown as Parameters<typeof callStructuredWithRetry>[0],
      [new SystemMessage(scriptAgentPrompt("story") + languageInstruction(lang)), new HumanMessage(`User brief: ${state.goal}`)],
      "script_agent",
      writer,
      (chunk) => writer?.write("recipe", mergeRecipe(state.recipe, chunk as Record<string, unknown>)),
    );

    const recipe = mergeRecipe(state.recipe, partial as Record<string, unknown>);
    console.log("[script_agent] completed, title:", (recipe as Record<string, unknown>).title);
    sendAgentProgress(writer, "script_agent", "completed");
    await sleep(80);

    return { recipe, currentStep: "script_agent" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[script_agent] failed:", message);
    sendAgentProgress(writer, "script_agent", "failed");
    return { error: message, currentStep: "error" };
  }
}
