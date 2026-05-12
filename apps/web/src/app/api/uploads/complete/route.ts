import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import { minioStorage } from "@/server/storage/minio";

const schema = z.object({
  uploadId: z.string(),
  title: z.string().optional(),
  type: z.enum(["IMAGE", "VIDEO", "AUDIO", "TEXT", "RENDER", "OTHER"]).default("OTHER"),
  threadId: z.string().optional(),
  blockId: z.string().optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const body = schema.parse(await request.json());
  const upload = await prisma.upload.findUniqueOrThrow({ where: { id: body.uploadId } });
  const asset = await prisma.asset.create({
    data: {
      title: body.title || upload.fileName,
      type: body.type,
      objectKey: upload.objectKey,
      url: minioStorage.getPublicUrl(upload.objectKey),
      mimeType: upload.mimeType,
      size: upload.size,
      threadId: body.threadId,
      blockId: body.blockId,
      userId: user?.id,
    },
  });
  await prisma.upload.update({
    where: { id: upload.id },
    data: { status: "COMPLETED", completedAt: new Date(), assetId: asset.id, userId: user?.id },
  });
  return NextResponse.json({ asset });
}
