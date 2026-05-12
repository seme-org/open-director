import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { prepareCreationMedia } from "@/server/agent/utils/task-planner";
import { prisma } from "@/server/db/prisma";

const creationToolNames = ["create_character", "image_to_image", "tts_create", "text_to_bgm"];

export async function POST(_request: Request, context: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await context.params;
  const user = await getCurrentUser();

  try {
    const running = await prisma.toolCall.findFirst({
      where: {
        threadId,
        name: { in: creationToolNames },
        status: { in: ["PENDING", "RUNNING"] },
      },
      select: { id: true },
    });

    if (running) {
      return NextResponse.json({ started: false, status: "running" });
    }

    void prepareCreationMedia({ threadId, userId: user?.id }).catch((error) => {
      console.error("prepareCreationMedia failed", { threadId, error });
    });

    return NextResponse.json({ started: true, status: "started" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
