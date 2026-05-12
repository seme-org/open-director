import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

export async function GET(_request: Request, context: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await context.params;
  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    include: {
      items: {
        orderBy: { order: "asc" },
        include: {
          outputs: { orderBy: { createdAt: "asc" } },
          jobs: true,
        },
      },
    },
  });

  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  return NextResponse.json({ batch });
}

export async function DELETE(_request: Request, context: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await context.params;
  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
  });

  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  await prisma.batch.update({
    where: { id: batchId },
    data: { deleted: true },
  });

  return NextResponse.json({ success: true });
}
