import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

export async function GET(_request: Request, context: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await context.params;
  const recipes = await prisma.recipe.findMany({
    where: { threadId },
    orderBy: [{ version: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ recipes });
}
