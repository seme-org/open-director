import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import { createRenderQueue } from "@/server/queue/adapter";

const schema = z.object({
  threadId: z.string().optional(),
  messageId: z.string().optional(),
  title: z.string().optional(),
  items: z
    .array(
      z.object({
        audio: z
          .array(
            z.object({
              url: z.string().optional(),
              text: z.string().optional(),
              duration: z.number().optional(),
            }),
          )
          .optional(),
        image: z.object({ url: z.string() }).optional(),
        video: z.object({ url: z.string(), duration: z.number().optional() }).optional(),
        sub_title: z.object({ text: z.string() }).optional(),
      }),
    )
    .default([]),
  bg_audios: z
    .array(z.object({ url: z.string(), volume: z.number().optional() }))
    .optional(),
  input_parameter: z
    .object({
      advancedParameters: z
        .object({
          isGenerateTransition: z.enum(["yes", "no"]).optional(),
          isGenerateVideoEffect: z.enum(["yes", "no"]).optional(),
          isGenerateTitle: z.enum(["yes", "no"]).optional(),
          isGenerateSubtitle: z.enum(["yes", "no"]).optional(),
          isGenerateTitleAnimation: z.enum(["yes", "no"]).optional(),
          isGenerateSubtitleAnimation: z.enum(["yes", "no"]).optional(),
          titleAnimation: z.string().optional(),
          subtitleAnimation: z.string().optional(),
          titleStyle: z.string().optional(),
          subtitleStyle: z.string().optional(),
          videoEffectStyle: z.string().optional(),
          transitionStyle: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  aspect_ratio: z.string().optional(),
  resolution: z.union([z.literal(480), z.literal(720), z.literal(1080)]).optional(),
  isFreeUser: z.boolean().optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const body = schema.parse(await request.json());

  let validThreadId: string | null = null;
  if (body.threadId) {
    const thread = await prisma.thread.findUnique({
      where: { id: body.threadId },
      select: { id: true },
    });
    if (thread) validThreadId = thread.id;
  }

  const job = await prisma.job.create({
    data: {
      type: "render.quickConcat",
      threadId: validThreadId,
      userId: user?.id,
      input: body,
    },
  });

  await prisma.job.update({
    where: { id: job.id },
    data: { queueId: job.id },
  });

  const queue = createRenderQueue();
  const queueJob = await queue.add(
    "quick-concat",
    { ...body, userId: user?.id },
    { jobId: job.id },
  );
  await queue.close();

  return NextResponse.json({ jobId: job.id, queueId: queueJob.id });
}
