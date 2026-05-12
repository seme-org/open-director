import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function textValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

export async function GET(_request: Request, context: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await context.params;
  const jobs = await prisma.job.findMany({
    where: {
      threadId,
      type: "render.quickConcat",
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { renderOutputs: true },
  });

  return NextResponse.json({
    exports: jobs.map((job) => ({
      id: job.id,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt.toISOString(),
      videoUrl: textValue(asRecord(job.output).url) || job.renderOutputs[0]?.url,
    })),
  });
}
