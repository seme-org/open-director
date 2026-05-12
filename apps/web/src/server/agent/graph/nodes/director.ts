import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import type { DirectorState } from "../state";
import { DIRECTOR_TOOLS } from "../tools";
import { loadPublicArtStyles, artStylePromptLines } from "@/server/agent/art-styles";
import { buildDirectorBrief } from "@/server/agent/utils/director-brief";
import type { DirectorBriefDraft } from "@/server/agent/schemas/director-brief";
import type { SSEWriter } from "../sse-writer";

function createModel() {
  return new ChatOpenAI({
    modelName: process.env.OPENAI_MODEL || "gpt-4o-mini",
    openAIApiKey: process.env.OPENAI_API_KEY || "missing-key",
    configuration: { baseURL: process.env.OPENAI_BASE_URL },
  });
}

export async function directorNode(
  state: typeof DirectorState.State,
  config?: { configurable?: { writer?: SSEWriter } },
) {
  const writer = config?.configurable?.writer;
  writer?.write("agent-status", { node: "director_node", status: "running" });

  const artStyleCatalog = await loadPublicArtStyles();
  const llm = createModel().bindTools(DIRECTOR_TOOLS);

  const result = await llm.invoke([
    new SystemMessage([
      "You are OpenDirector's director_node.",
      "Create the first director brief worksheet from the user's rough idea.",
      "Call the generate_director_brief tool with the brief data.",
      artStyleCatalog.length
        ? `Available art styles:\n${artStylePromptLines(artStyleCatalog)}`
        : "No art style catalog is available; return a concise style name.",
    ].join("\n")),
    new HumanMessage(`User idea: ${state.goal}`),
  ]);

  // If LLM returned tool_calls, extract the brief from tool args and write SSE event
  if (result.tool_calls?.length) {
    const briefToolCall = result.tool_calls.find(
      (tc: any) => tc.name === "generate_director_brief",
    );
    if (briefToolCall) {
      const brief = buildDirectorBrief(state.goal, artStyleCatalog, briefToolCall.args as DirectorBriefDraft);
      writer?.write("director-brief", brief);
      writer?.write("agent-status", { node: "director_node", status: "completed" });
      // Return a clean message without tool_calls so afterDirector routes to update_state
      const cleanMessage = new AIMessage({ content: result.content });
      return {
        messages: [cleanMessage],
        directorBrief: brief,
        needsConfirmation: true,
      };
    }
  }

  // Fallback: LLM didn't call tool, build brief from its text response
  const brief = buildDirectorBrief(state.goal, artStyleCatalog);
  writer?.write("director-brief", brief);
  writer?.write("agent-status", { node: "director_node", status: "completed" });

  return {
    messages: [result],
    directorBrief: brief,
    needsConfirmation: true,
  };
}
