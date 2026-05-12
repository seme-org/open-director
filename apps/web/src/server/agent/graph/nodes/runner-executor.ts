import type { DirectorState } from "../state";
import { executeRunnerTasks } from "@/server/agent/media-provider";
import { prisma } from "@/server/db/prisma";
import type { SSEWriter } from "../sse-writer";

export async function runnerExecutorNode(
  state: typeof DirectorState.State,
  config?: { configurable?: { writer?: SSEWriter } },
) {
  const writer = config?.configurable?.writer;
  writer?.write("agent-status", { node: "runner", status: "running" });

  const tasks = state.runnerTasks;
  const existingAssets = state.mediaAssets;
  const completedTaskIds = new Set(
    existingAssets.map((a: any) => a.taskId).filter(Boolean),
  );
  const pendingTasks = tasks.filter((t) => !completedTaskIds.has(t.id));

  if (pendingTasks.length === 0) {
    writer?.write("agent-status", { node: "runner", status: "completed" });
    return {};
  }

  const blocks = await prisma.block.findMany({
    where: { threadId: state.threadId },
    select: { id: true, title: true },
    orderBy: { order: "asc" },
  });

  const collectedAssets: any[] = [...existingAssets];
  try {
    let completedInBatch = 0;
    let failedInBatch = 0;
    const newAssets = await executeRunnerTasks({
      threadId: state.threadId,
      userId: state.userId,
      recipeId: state.recipeId,
      tasks: pendingTasks,
      blocks,
      onTaskStatus: (event: any) => {
        if (event.status === "completed") {
          completedInBatch++;
          if (event.asset) {
            collectedAssets.push(event.asset);
            writer?.write("media-assets", { assets: [...collectedAssets] });
          }
        }
        if (event.status === "failed") failedInBatch++;
        writer?.write("runner-progress", {
          taskCount: tasks.length,
          completedCount: existingAssets.length + completedInBatch,
          failedCount: failedInBatch,
          running: event.status === "running" ? [{ id: event.task.id, tool: event.task.tool, sceneTitle: event.task.sceneTitle }] : [],
          lastTask: { id: event.task.id, tool: event.task.tool, sceneTitle: event.task.sceneTitle, status: event.status, assetId: event.asset?.assetId, error: event.error },
        });
      },
    });

    const allAssets = [...existingAssets, ...newAssets];
    writer?.write("media-assets", { assets: allAssets });
    writer?.write("agent-status", { node: "runner", status: "completed", assetCount: allAssets.length });

    return { mediaAssets: allAssets };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    writer?.write("agent-status", { node: "runner", status: "failed", error: message });
    return { error: message, mediaAssets: collectedAssets };
  }
}
