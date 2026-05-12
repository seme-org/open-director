import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { DirectorState } from "../../state";
import { voiceOutputSchema, type VoiceOutput } from "@/server/agent/schemas/recipe-parts";
import { voiceAgentPrompt } from "../prompts/voice";
import { createModel, sendAgentProgress, sleep, resolveLanguage, languageInstruction, callStructuredWithRetry } from "./shared";
import type { DirectorRecipe } from "@/server/agent/schemas/recipe";
import type { SSEWriter } from "../../sse-writer";

function applyVoiceMapping(
  recipe: Partial<DirectorRecipe>,
  voiceOutput: VoiceOutput,
): Partial<DirectorRecipe> {
  const scenes = recipe.scenes;
  if (!scenes) return recipe;

  const ttsByShotId = new Map<string, string>();
  for (const entry of voiceOutput.voiceMapping) {
    ttsByShotId.set(entry.shotId, entry.ttsText);
  }

  const mergedScenes = scenes.map((scene) => ({
    ...scene,
    shots: scene.shots.map((shot) => ({
      ...shot,
      ttsText: ttsByShotId.get(shot.shotId) ?? (shot as Record<string, unknown>).ttsText,
    })),
  }));

  return { ...recipe, scenes: mergedScenes };
}

export async function voiceAgentNode(
  state: typeof DirectorState.State,
  config?: { configurable?: { writer?: SSEWriter } },
) {
  const writer = config?.configurable?.writer;
  console.log("[voice_agent] starting");
  sendAgentProgress(writer, "voice_agent", "running");

  try {
    const recipe = state.recipe || {};
    const r = recipe as Record<string, unknown>;
    const lang = resolveLanguage(state.directorBrief as Record<string, unknown> | undefined, r.language as string | undefined);
    const scenes = r.scenes as Array<Record<string, unknown>> | undefined;
    const shotsContext = scenes?.flatMap((s) =>
      (s.shots as Array<Record<string, unknown>> || []).map((shot) => ({
        shotId: shot.shotId,
        description: shot.description,
        dialogue: shot.dialogue,
      })),
    ) || [];

    const llm = createModel().withStructuredOutput(voiceOutputSchema, {
      name: "generate_voice",
    });

    const context = `Storyboard shots: ${JSON.stringify(shotsContext, null, 2)}`;

    const partial = await callStructuredWithRetry(
      llm as unknown as Parameters<typeof callStructuredWithRetry>[0],
      [new SystemMessage(voiceAgentPrompt("story") + languageInstruction(lang)), new HumanMessage(context)],
      "voice_agent",
      writer,
      (chunk) => writer?.write("recipe", applyVoiceMapping(recipe, chunk as VoiceOutput)),
    );

    const updated = applyVoiceMapping(recipe, partial as VoiceOutput);
    console.log("[voice_agent] completed, tts entries:", (partial as VoiceOutput).voiceMapping?.length ?? 0);
    sendAgentProgress(writer, "voice_agent", "completed");
    await sleep(80);

    return { recipe: updated, currentStep: "voice_agent" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[voice_agent] failed:", message);
    sendAgentProgress(writer, "voice_agent", "failed");
    return { error: message, currentStep: "error" };
  }
}
