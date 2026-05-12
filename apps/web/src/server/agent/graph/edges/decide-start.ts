const VALID_NODES = new Set([
  "director_node",
  "recipe_node",
  "block_planner",
  "runner_executor",
  "update_state",
]);

export function decideStartNode(state: { startNode?: string }): string {
  const target = state.startNode || "director_node";
  return VALID_NODES.has(target) ? target : "director_node";
}
