import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { recipeWorkflowPreviewComponents } from "@/server/agent/recipe-workflow";
import type { DirectorRecipe, DirectorIntent, DirectorWorkflowResult } from "@/server/agent/schemas/recipe";
import { normalizeRecipe } from "@/server/agent/utils/recipe-normalize";
import { loadPublicArtStyles } from "@/server/agent/art-styles";
import { loadAvailableVoices } from "@/server/agent/voices";
import { extractAspectRatioFromPrompt } from "@/server/agent/utils/commands";
import { buildStoryboardBlocks } from "@/server/agent/utils/task-planner";

const recipeComponents = recipeWorkflowPreviewComponents;

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function buildRecipeGeneratorFailureState(input: {
  threadId: string;
  prompt: string;
  intent: DirectorIntent;
  directorBrief: unknown;
  error: unknown;
  partialRecipe?: Partial<DirectorRecipe>;
}) {
  const state = toJson({
    current_node: "recipe_generator",
    intent: input.intent,
    goal: input.prompt,
    directorBrief: input.directorBrief,
    partialRecipe: input.partialRecipe,
    error: errorText(input.error),
    retryable: true,
  });
  return {
    where: { threadId: input.threadId },
    update: {
      currentStep: "recipe_generator_failed",
      state,
    },
    create: {
      threadId: input.threadId,
      currentStep: "recipe_generator_failed",
      state,
    },
  };
}

export async function persistDirectorWorkflow(input: {
  threadId: string;
  userId?: string;
  prompt: string;
  recipe: DirectorRecipe;
  toolCallIds?: string[];
}): Promise<DirectorWorkflowResult> {
  const { threadId, userId, prompt, toolCallIds = [] } = input;
  const recipe = normalizeRecipe(
    input.recipe,
    await loadPublicArtStyles(),
    await loadAvailableVoices(userId),
  );
  const aspectRatio = extractAspectRatioFromPrompt(prompt);
  const persistedRecipe = aspectRatio ? { ...recipe, aspectRatio } : recipe;

  await prisma.thread.update({
    where: { id: threadId },
    data: {
      title: recipe.title.slice(0, 120),
      description: prompt,
      intent: recipe.intent,
      metadata: {
        audience: recipe.audience,
        tone: recipe.tone,
        language: recipe.language,
        ...(aspectRatio ? { aspectRatio } : {}),
        components: recipeComponents,
      },
    },
  });

  const persisted = await prisma.recipe.create({
    data: {
      threadId,
      title: recipe.title,
      kind: recipe.intent || "story",
      content: persistedRecipe,
    },
  });

  const storyboardBlocks = buildStoryboardBlocks(recipe);

  await prisma.block.deleteMany({ where: { threadId } });
  await prisma.block.createMany({
    data: storyboardBlocks.map((block) => ({
      threadId,
      order: block.order,
      title: block.title,
      script: block.script,
      visualPrompt: block.visualPrompt,
      audioPrompt: block.audioPrompt,
      metadata: toJson(block.metadata),
    })),
  });

  await prisma.agentState.upsert({
    where: { threadId },
    update: {
      currentStep: "recipe_generator",
      state: {
        start_node: "director_node",
        current_node: "block_planner",
        intent: recipe.intent,
        goal: prompt,
        recipeId: persisted.id,
        recipes: persistedRecipe,
        components: recipeComponents,
        next_nodes: ["block_planner", "runner"],
      },
    },
    create: {
      threadId,
      currentStep: "recipe_generator",
      state: {
        start_node: "director_node",
        current_node: "block_planner",
        intent: recipe.intent,
        goal: prompt,
        recipeId: persisted.id,
        recipes: persistedRecipe,
        components: recipeComponents,
        next_nodes: ["block_planner", "runner"],
      },
    },
  });

  await prisma.toolCall.createMany({
    data: [
      {
        threadId,
        userId,
        name: "generate_complete_recipe",
        status: "COMPLETED",
        args: { prompt },
        result: { recipeId: persisted.id, intent: recipe.intent },
      },
      {
        threadId,
        userId,
        name: "create_blocks",
        status: "COMPLETED",
        args: { scenes: recipe.scenes.length, blocks: storyboardBlocks.length },
        result: { blockCount: storyboardBlocks.length },
      },
    ],
  });

  return {
    threadId,
    recipe: persistedRecipe,
    recipeId: persisted.id,
    blockCount: storyboardBlocks.length,
    toolCallIds,
  };
}
