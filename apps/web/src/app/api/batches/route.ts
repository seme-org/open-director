import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import { parseBatchItems, parseBatchLines } from "@/server/batch/input";
import { normalizeBatchSettings } from "@/server/batch/settings";

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function GET() {
  const user = await getCurrentUser();
  const batches = await prisma.batch.findMany({
    where: {
      deleted: false,
      ...(user?.id ? { userId: user.id } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      items: {
        orderBy: { order: "asc" },
        include: { outputs: true },
      },
    },
  });

  return NextResponse.json({ batches });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const body = await request.json();
  const parsedItems = Array.isArray(body.items) ? parseBatchItems(body.items) : parseBatchLines(String(body.input || ""));
  const settings = normalizeBatchSettings(body.settings);

  const batch = await prisma.batch.create({
    data: {
      userId: user?.id,
      title: String(body.title || "Batch"),
      status: "DRAFT_CREATED",
      itemCount: parsedItems.length,
      outputCount: parsedItems.length * settings.video.outputsPerItem,
      settings: toJson(settings),
      items: {
        create: parsedItems.map((item) => ({
          order: item.order,
          subject: item.subject || null,
          script: item.script || null,
          terms: item.terms.length ? toJson(item.terms) : undefined,
          status: "DRAFT_CREATED",
        })),
      },
    },
    include: {
      items: {
        orderBy: { order: "asc" },
        include: { outputs: true },
      },
    },
  });

  return NextResponse.json({ batch });
}
