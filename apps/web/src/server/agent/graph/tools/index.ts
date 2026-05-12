import { generateDirectorBriefTool } from "./director-brief";
import { generateCompleteRecipeTool } from "./recipe";

export const DIRECTOR_TOOLS = [generateDirectorBriefTool];
export const RECIPE_TOOLS = [generateCompleteRecipeTool];
export const ALL_TOOLS = [...DIRECTOR_TOOLS, ...RECIPE_TOOLS];
