import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";

const createSchema = z.object({
  title: z.string().min(1).max(120).default("Untitled video"),
  description: z.string().optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  const threads = await prisma.thread.findMany({
    where: {
      isDeleted: false,
      ...(user ? { userId: user.id } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 40,
  });
  return NextResponse.json({ threads });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = createSchema.parse(await request.json());
  const thread = await prisma.thread.create({
    data: {
      title: body.title,
      description: body.description,
      userId: user.id,
    },
  });
  return NextResponse.json({ thread });
}
