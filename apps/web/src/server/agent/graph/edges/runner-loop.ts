import type { RunnerTask } from "@/server/agent/media-provider";

export function afterUpdateAndContinue(state: {
  runnerTasks: RunnerTask[];
  mediaAssets: Record<string, unknown>[];
}): string {
  const completedAssetCount = state.mediaAssets.length;
  const totalTasks = state.runnerTasks.length;

  if (completedAssetCount < totalTasks) {
    return "auto_runner";
  }
  return "update_state";
}
