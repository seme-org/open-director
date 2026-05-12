import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { recipeSchema } from "@/server/agent/schemas/recipe";
import { persistDirectorWorkflow } from "@/server/agent/utils/recipe-persist";
import { normalizeRecipe } from "@/server/agent/utils/recipe-normalize";
import { loadPublicArtStyles } from "@/server/agent/art-styles";
import { loadAvailableVoices } from "@/server/agent/voices";

export const generateCompleteRecipeTool = new DynamicStructuredTool({
  name: "generate_complete_recipe",
  description: "Generate a complete video production recipe including title, story, characters, scenes, shots, art style, BGM, and media prompts. Returns the recipe with persistence identifiers.",
  schema: z.object({
    recipe: recipeSchema.describe("The complete recipe object"),
  }),
  async func(input, _runManager, config) {
    const userId = config?.configurable?.userId;
    const threadId = config?.configurable?.threadId;
    const prompt = config?.configurable?.goal;

    const artStyleCatalog = await loadPublicArtStyles();
    const voiceCatalog = await loadAvailableVoices(userId);
    const normalized = normalizeRecipe(input.recipe, artStyleCatalog, voiceCatalog);

    if (threadId) {
      const result = await persistDirectorWorkflow({
        threadId,
        userId,
        prompt: prompt || "",
        recipe: normalized,
      });
      return JSON.stringify(result);
    }

    return JSON.stringify({ recipe: normalized });
  },
});
