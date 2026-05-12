import type { BaseMessage } from "@langchain/core/messages";
import { AIMessage } from "@langchain/core/messages";
import type { RunnerTask } from "@/server/agent/media-provider";

export function hasToolCalls(state: { messages: BaseMessage[] }): boolean {
  const last = state.messages[state.messages.length - 1];
  if (!last) return false;
  if (last instanceof AIMessage && last.tool_calls?.length) return true;
  return false;
}

export function afterDirector(state: { messages: BaseMessage[] }): string {
  return hasToolCalls(state) ? "director_tools" : "update_state";
}

export function hasPendingTasks(state: {
  runnerTasks: RunnerTask[];
  mediaAssets: Record<string, unknown>[];
}): string {
  const completedIds = new Set(state.mediaAssets.map((a: any) => a.taskId).filter(Boolean));
  const pending = state.runnerTasks.filter((t) => !completedIds.has(t.id));
  return pending.length > 0 ? "runner_executor" : "update_state";
}
