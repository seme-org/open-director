import { StateGraph, MemorySaver, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { DirectorState } from "./state";
import {
  decideStartNode,
  directorNode,
  blockPlannerNode,
  runnerExecutorNode,
  updateStateNode,
  researchAgentNode,
  scriptAgentNode,
  artStyleAgentNode,
  storyboardAgentNode,
  characterAgentNode,
  locationAgentNode,
  voiceAgentNode,
  bgmAgentNode,
  mediaAgentNode,
} from "./nodes";
import { DIRECTOR_TOOLS } from "./tools";
import { decideStartNode as decideStartEdge } from "./edges/decide-start";
import { afterDirector, hasPendingTasks } from "./edges/agent-tool";
import { afterUpdateAndContinue } from "./edges/runner-loop";

const checkpointer = new MemorySaver();

const directorTools = new ToolNode(DIRECTOR_TOOLS);

const graph = new StateGraph(DirectorState)
  // Nodes
  .addNode("decide_start", decideStartNode)
  .addNode("director_node", directorNode)
  .addNode("director_tools", directorTools)
  .addNode("block_planner", blockPlannerNode)
  .addNode("runner_executor", runnerExecutorNode)
  .addNode("update_state", updateStateNode)

  // Recipe agent nodes
  .addNode("research_agent", researchAgentNode)
  .addNode("script_agent", scriptAgentNode)
  .addNode("art_style_agent", artStyleAgentNode)
  .addNode("storyboard_agent", storyboardAgentNode)
  .addNode("character_agent", characterAgentNode)
  .addNode("location_agent", locationAgentNode)
  .addNode("voice_agent", voiceAgentNode)
  .addNode("bgm_agent", bgmAgentNode)
  .addNode("media_agent", mediaAgentNode)

  // Start -> decide_start
  .addEdge(START, "decide_start")

  // decide_start -> conditional routing
  .addConditionalEdges("decide_start", decideStartEdge, {
    director_node: "director_node",
    recipe_node: "research_agent",
    block_planner: "block_planner",
    runner_executor: "runner_executor",
    update_state: "update_state",
  })

  // director_node -> tool_calls? -> director_tools : update_state
  .addConditionalEdges("director_node", afterDirector, {
    director_tools: "director_tools",
    update_state: "update_state",
  })
  .addEdge("director_tools", "update_state")

  // Recipe agent pipeline: sequential chain -> block_planner
  .addEdge("research_agent", "script_agent")
  .addEdge("script_agent", "art_style_agent")
  .addEdge("art_style_agent", "storyboard_agent")
  .addEdge("storyboard_agent", "character_agent")
  .addEdge("character_agent", "location_agent")
  .addEdge("location_agent", "voice_agent")
  .addEdge("voice_agent", "bgm_agent")
  .addEdge("bgm_agent", "media_agent")
  .addEdge("media_agent", "block_planner")

  // block_planner -> has pending tasks? -> runner_executor : update_state
  .addConditionalEdges("block_planner", hasPendingTasks, {
    runner_executor: "runner_executor",
    update_state: "update_state",
  })

  // runner_executor -> pending? -> runner_executor (loop) : update_state
  .addConditionalEdges("runner_executor", afterUpdateAndContinue, {
    runner_executor: "runner_executor",
    update_state: "update_state",
  })

  // update_state -> END
  .addEdge("update_state", END)

  .compile({ checkpointer });

export { graph };
