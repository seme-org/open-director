import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";

const schema = z.object({
  threadId: z.string(),
  role: z.string(),
  content: z.string().optional(),
  parts: z.unknown().optional(),
  attachments: z.unknown().optional(),
  annotations: z.unknown().optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const threadId = searchParams.get("threadId");
  if (!threadId) return NextResponse.json({ error: "threadId required" }, { status: 400 });
  const messages = await prisma.message.findMany({
    where: { threadId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ messages });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const body = schema.parse(await request.json());
  const message = await prisma.message.create({
    data: {
      threadId: body.threadId,
      role: body.role,
      content: body.content,
      parts: body.parts === undefined ? undefined : (body.parts as object),
      attachments: body.attachments === undefined ? undefined : (body.attachments as object),
      annotations: body.annotations === undefined ? undefined : (body.annotations as object),
      userId: user?.id,
    },
  });
  return NextResponse.json({ message });
}
