import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { config } from "./config.js";
import { prisma } from "./db.js";
import { createAndRunCreator } from "./renderer.js";
import { prepareAssets, determineCanvasSize } from "./asset-processor.js";
import { updateBatchItemIfExists } from "./batch-progress.js";
import { updateParentBatchIfFinished } from "./batch-status.js";
import { cleanupFiles } from "./cleanup.js";
import type { RenderJobInput } from "./types.js";
import {
  mapCreatorProgressToBatchItemProgress,
  mapCreatorProgressToJobProgress,
} from "./render-progress.js";

const connection = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null,
});

const worker = new Worker<RenderJobInput>(
  config.queueName,
  async (queueJob) => {
    const queueId = String(queueJob.id);
    const input = queueJob.data;

    const dbJob =
      (await prisma.job.findUnique({ where: { id: queueId } })) ??
      (await prisma.job.findUnique({ where: { queueId } }));

    if (dbJob) {
      await prisma.job.update({
        where: { id: dbJob.id },
        data: { status: "ACTIVE", progress: 10 },
      });
      if (input.batchItemId) {
        const batchItemExists = await updateBatchItemIfExists(prisma, input.batchItemId, {
          status: "ACTIVE",
          progress: 65,
          error: null,
          finishedAt: null,
        });
        if (!batchItemExists) {
          throw new Error(`Batch item ${input.batchItemId} no longer exists.`);
        }
      }
    }

    let tempFiles: string[] = [];

    try {
      const { processedItems, tempFiles: tf, bgAudios, narrationAudio } = await prepareAssets(
        input.items,
        input.bg_audios,
        input.narration_audio,
        queueId,
      );
      tempFiles = tf;

      if (dbJob) {
        await prisma.job.update({
          where: { id: dbJob.id },
          data: { progress: 30 },
        });
      }

      const { width, height } = determineCanvasSize(
        processedItems,
        input.aspect_ratio,
        queueId,
        input.resolution,
      );

      if (dbJob) {
        await prisma.job.update({
          where: { id: dbJob.id },
          data: { progress: 40 },
        });
      }

      let lastPersistedProgress = 40;
      const updateRenderProgress = async (creatorProgress: number) => {
        const progress = mapCreatorProgressToJobProgress(creatorProgress);
        if (progress <= lastPersistedProgress) return;
        lastPersistedProgress = progress;
        await queueJob.updateProgress(progress);
        if (dbJob) {
          await prisma.job.update({
            where: { id: dbJob.id },
            data: { progress },
          });
          if (input.batchItemId) {
            await updateBatchItemIfExists(prisma, input.batchItemId, {
              progress: mapCreatorProgressToBatchItemProgress(creatorProgress),
            });
          }
        }
      };

      const result = await createAndRunCreator(
        processedItems,
        bgAudios,
        width,
        height,
        queueId,
        tempFiles,
        input.input_parameter,
        input.title ? { text: input.title } : undefined,
        narrationAudio,
        input.isFreeUser ?? false,
        { onProgress: updateRenderProgress },
      );

      if (dbJob) {
        const asset = await prisma.asset.create({
          data: {
            threadId: input.threadId,
            userId: input.userId,
            type: "RENDER",
            title: input.title || "Rendered video",
            url: result.url,
            objectKey: result.objectKey,
            mimeType: "video/mp4",
          },
        });

        await prisma.renderOutput.create({
          data: {
            threadId: input.threadId,
            userId: input.userId,
            jobId: dbJob.id,
            assetId: asset.id,
            objectKey: result.objectKey,
            url: result.url,
            metadata: result,
          },
        });

        if (input.batchItemId) {
          await prisma.batchOutput.create({
            data: {
              batchItemId: input.batchItemId,
              jobId: dbJob.id,
              objectKey: result.objectKey,
              url: result.url,
              title: input.title || `Output ${input.batchOutputIndex ?? ""}`.trim(),
              metadata: result,
            },
          });

          await updateBatchItemIfExists(prisma, input.batchItemId, {
            status: "COMPLETED",
            progress: 100,
            finishedAt: new Date(),
          });
          await updateParentBatchIfFinished(prisma, input.batchItemId);
        }

        await prisma.job.update({
          where: { id: dbJob.id },
          data: {
            status: "COMPLETED",
            progress: 100,
            output: result,
            finishedAt: new Date(),
          },
        });
      }

      return result;
    } catch (error) {
      if (dbJob) {
        await prisma.job.update({
          where: { id: dbJob.id },
          data: {
            status: "FAILED",
            error: error instanceof Error ? error.message : String(error),
            finishedAt: new Date(),
          },
        });

        if (input.batchItemId) {
          await updateBatchItemIfExists(prisma, input.batchItemId, {
            status: "FAILED",
            error: error instanceof Error ? error.message : String(error),
            finishedAt: new Date(),
          });
          await updateParentBatchIfFinished(prisma, input.batchItemId);
        }
      }
      throw error;
    } finally {
      await cleanupFiles(tempFiles);
    }
  },
  {
    connection,
    concurrency: Number(process.env.WORKER_CONCURRENCY || 1),
  },
);

worker.on("failed", async (job, error) => {
  if (!job) return;
  const queueId = String(job.id);
  const dbJobs = await prisma.job.findMany({
    where: { OR: [{ id: queueId }, { queueId }] },
    select: { id: true, batchItemId: true },
  });

  await prisma.job.updateMany({
    where: { OR: [{ id: queueId }, { queueId }] },
    data: {
      status: "FAILED",
      error: error instanceof Error ? error.message : String(error),
      finishedAt: new Date(),
    },
  });

  const batchItemIds = dbJobs.map((dbJob) => dbJob.batchItemId).filter((id): id is string => Boolean(id));
  if (batchItemIds.length) {
    await prisma.batchItem.updateMany({
      where: { id: { in: batchItemIds } },
      data: {
        status: "FAILED",
        error: error instanceof Error ? error.message : String(error),
        finishedAt: new Date(),
      },
    });
    await Promise.all(batchItemIds.map((batchItemId) => updateParentBatchIfFinished(prisma, batchItemId)));
  }
});

console.log(`[render] listening on queue ${config.queueName}`);
