import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

export async function POST(request: Request) {
  const body = await request.json();
  const toolCall = await prisma.toolCall.create({
    data: {
      threadId: body.threadId,
      name: body.toolType || "asset.chat",
      status: "COMPLETED",
      args: body,
      result: {
        message: "Asset chat is wired. Connect a provider adapter to generate real assets.",
      },
    },
  });
  return NextResponse.json({ toolCall });
}
