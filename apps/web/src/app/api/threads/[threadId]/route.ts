import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";

export async function DELETE(_request: Request, context: { params: Promise<{ threadId: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { threadId } = await context.params;
  const result = await prisma.thread.updateMany({
    where: {
      id: threadId,
      userId: user.id,
      isDeleted: false,
    },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
    },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
