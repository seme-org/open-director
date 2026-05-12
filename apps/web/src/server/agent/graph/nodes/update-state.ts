import type { DirectorState } from "../state";
import { prisma } from "@/server/db/prisma";
import type { SSEWriter } from "../sse-writer";

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

export async function updateStateNode(
  state: typeof DirectorState.State,
  config?: { configurable?: { writer?: SSEWriter } },
) {
  if (!state.threadId) return {};

  try {
    await prisma.agentState.upsert({
      where: { threadId: state.threadId },
      update: {
        currentStep: state.currentStep || "idle",
        state: toJson({
          current_node: state.currentStep,
          intent: "story",
          goal: state.goal,
          directorBrief: state.directorBrief,
          recipeId: state.recipeId,
          recipes: state.recipe ? [state.recipe] : undefined,
          runnerTasks: state.runnerTasks,
          mediaAssets: state.mediaAssets,
        }),
      },
      create: {
        threadId: state.threadId,
        currentStep: state.currentStep || "idle",
        state: toJson({
          current_node: state.currentStep,
          intent: "story",
          goal: state.goal,
          directorBrief: state.directorBrief,
          recipeId: state.recipeId,
          recipes: state.recipe ? [state.recipe] : undefined,
          runnerTasks: state.runnerTasks,
          mediaAssets: state.mediaAssets,
        }),
      },
    });
  } catch (err) {
    console.error("[update-state] failed:", err instanceof Error ? err.message : String(err));
  }

  return {};
}
