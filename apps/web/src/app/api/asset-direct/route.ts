import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

export async function POST(request: Request) {
  const body = await request.json();
  const toolCall = await prisma.toolCall.create({
    data: {
      threadId: body.threadId,
      name: body.toolType || "asset.direct",
      status: "COMPLETED",
      args: body,
      result: { status: "completed", output: [] },
    },
  });
  return NextResponse.json({ toolCall });
}
