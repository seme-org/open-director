import type { DirectorState } from "../state";

export async function decideStartNode(
  state: typeof DirectorState.State,
) {
  const brief = (state.directorBrief || {}) as Record<string, unknown>;
  const exam = brief.exam as Record<string, unknown> | undefined;
  const choices = Array.isArray(exam?.single_choice) ? exam.single_choice : [];
  const artChoice = choices.find((c: any) => c.key === "art_style");
  const selectedArt = artChoice ? (artChoice.options as any[])?.find((o: any) => o.default === 1)?.value : null;
  console.log("[decide_start] directorBrief.art_style:", selectedArt || "(not set)");
  console.log("[decide_start] startNode:", state.startNode || "director_node");

  return {
    directorBrief: state.directorBrief,
    needsConfirmation: state.needsConfirmation,
    goal: state.goal,
  };
}
