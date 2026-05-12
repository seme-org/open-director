import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";

const schema = z.object({
  title: z.string().min(1),
  type: z.enum(["IMAGE", "VIDEO", "AUDIO", "TEXT", "RENDER", "OTHER"]).default("OTHER"),
  url: z.string().optional(),
  objectKey: z.string().optional(),
  threadId: z.string().optional(),
  blockId: z.string().optional(),
  mimeType: z.string().optional(),
  metadata: z.unknown().optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const threadId = searchParams.get("threadId") || undefined;
  const assets = await prisma.asset.findMany({
    where: { threadId },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  return NextResponse.json({ assets });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const body = schema.parse(await request.json());
  const asset = await prisma.asset.create({
    data: {
      ...body,
      metadata: body.metadata === undefined ? undefined : (body.metadata as object),
      userId: user?.id,
    },
  });
  return NextResponse.json({ asset });
}
