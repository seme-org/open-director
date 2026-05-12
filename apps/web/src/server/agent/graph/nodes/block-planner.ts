import type { DirectorState } from "../state";
import { planRunnerTasks, buildStoryboardBlocks } from "@/server/agent/utils/task-planner";
import { prisma } from "@/server/db/prisma";
import type { DirectorRecipe } from "@/server/agent/schemas/recipe";
import type { AspectRatio } from "@/server/agent/media-provider";
import type { SSEWriter } from "../sse-writer";

function extractAspectRatio(directorBrief: Record<string, unknown> | undefined): AspectRatio | undefined {
  if (!directorBrief) return undefined;
  // 1. Direct field (from draft schema)
  const direct = directorBrief.aspect_ratio;
  if (direct === "16:9" || direct === "9:16" || direct === "1:1") return direct;
  // 2. From exam.single_choice
  const exam = directorBrief.exam as Record<string, unknown> | undefined;
  const singleChoice = exam?.single_choice as Array<Record<string, unknown>> | undefined;
  if (singleChoice) {
    const ratioChoice = singleChoice.find((c) => c.key === "aspect_ratio");
    if (ratioChoice) {
      const options = ratioChoice.options as Array<Record<string, unknown>> | undefined;
      const selected = options?.find((o) => Number(o.default) === 1);
      const value = selected?.value;
      if (value === "16:9" || value === "9:16" || value === "1:1") return value;
    }
  }
  return undefined;
}

export async function blockPlannerNode(
  state: typeof DirectorState.State,
  config?: { configurable?: { writer?: SSEWriter } },
) {
  const writer = config?.configurable?.writer;
  writer?.write("agent-status", { node: "block_planner", status: "running" });

  const recipe = state.recipe as DirectorRecipe | undefined;
  if (!recipe) {
    writer?.write("agent-status", { node: "block_planner", status: "failed", error: "No recipe found" });
    return { error: "No recipe found", currentStep: "error" };
  }

  // Inject aspectRatio from directorBrief if missing
  const aspectRatio = extractAspectRatio(state.directorBrief as Record<string, unknown> | undefined);
  const recipeWithRatio: DirectorRecipe = aspectRatio && !(recipe as Record<string, unknown>).aspectRatio
    ? { ...recipe, aspectRatio } as DirectorRecipe
    : recipe;

  const runnerTasks = planRunnerTasks(recipeWithRatio);
  const blocks = buildStoryboardBlocks(recipeWithRatio);

  const existingBlocks = await prisma.block.findMany({
    where: { threadId: state.threadId },
    select: { id: true, title: true },
  });

  if (!existingBlocks.length) {
    await prisma.block.createMany({
      data: blocks.map((block, index) => ({
        threadId: state.threadId,
        order: index,
        title: block.title,
        script: block.script,
        visualPrompt: block.visualPrompt,
        audioPrompt: block.audioPrompt,
        metadata: JSON.parse(JSON.stringify(block.metadata)),
      })),
    });
  }

  writer?.write("runner-tasks", { tasks: runnerTasks });
  writer?.write("agent-status", {
    node: "block_planner",
    status: "completed",
    next: "auto_runner",
    taskCount: runnerTasks.length,
  });

  return {
    recipe: recipeWithRatio,
    blocks: blocks.map((b) => ({ title: b.title })),
    runnerTasks,
    currentStep: "block_planner",
  };
}
