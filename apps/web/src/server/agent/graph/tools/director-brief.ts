import { DynamicStructuredTool } from "@langchain/core/tools";
import { directorBriefDraftSchema } from "@/server/agent/schemas/director-brief";
import { buildDirectorBrief } from "@/server/agent/utils/director-brief";
import { loadPublicArtStyles } from "@/server/agent/art-styles";

export const generateDirectorBriefTool = new DynamicStructuredTool({
  name: "generate_director_brief",
  description: "Generate a director brief worksheet from the user's creative idea. Returns project name, audience, language, aspect ratio, art style, duration, and workflow mode.",
  schema: directorBriefDraftSchema,
  async func(input) {
    const artStyleCatalog = await loadPublicArtStyles();
    const brief = buildDirectorBrief(input.project_name, artStyleCatalog, input);
    return JSON.stringify(brief);
  },
});
