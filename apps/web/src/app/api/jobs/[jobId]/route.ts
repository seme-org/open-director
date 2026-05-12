import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { createRenderQueue } from "@/server/queue/adapter";

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await context.params;
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { renderOutputs: true },
  });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  let queueState: {
    state: string | null;
    position: number | null;
    total: number | null;
  } | null = null;

  if (job.queueId) {
    const queue = createRenderQueue();
    try {
      const queueJob = await queue.getJob(job.queueId);
      if (queueJob) {
        const state = await queueJob.getState();
        const waitingJobs = await queue.getWaiting();
        const waitingIndex = waitingJobs.findIndex(
          (waitingJob) => waitingJob.id === queueJob.id,
        );
        queueState = {
          state,
          position: waitingIndex >= 0 ? waitingIndex + 1 : null,
          total: waitingJobs.length,
        };
      }
    } finally {
      await queue.close();
    }
  }

  return NextResponse.json({ job: { ...job, queue: queueState } });
}
