import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

export async function GET(_request: Request, context: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await context.params;
  const assets = await prisma.asset.findMany({
    where: { threadId },
    orderBy: { createdAt: "desc" },
  });
  const blocks = await prisma.block.findMany({
    where: { threadId },
    orderBy: { order: "asc" },
  });
  const toolCalls = await prisma.toolCall.findMany({
    where: { threadId },
    orderBy: { createdAt: "desc" },
    take: 80,
    select: { id: true, name: true, status: true, error: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json({ assets, blocks, toolCalls });
}
