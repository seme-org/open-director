import fs from "node:fs/promises";
import path from "node:path";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { createRenderQueue } from "@/server/queue/adapter";
import { minioStorage } from "@/server/storage/minio";
import { createEdgeTtsAudio } from "./edge-tts";
import {
  chooseMaterialProvider,
  listLocalVideos,
  searchPexelsVideos,
  searchPixabayVideos,
  type VideoMaterial,
} from "./materials";
import { buildRenderInputsForBatchItem } from "./pipeline";
import { normalizeBatchSettings, type BatchSettings } from "./settings";

type BatchItemInput = {
  subject: string | null;
  script: string | null;
};

type BatchTermsInput = {
  subject: string | null;
  resolvedScript: string;
  terms: unknown;
  searchMode?: BatchSettings["materials"]["searchMode"];
};

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function rootPath(...segments: string[]) {
  return path.resolve(process.cwd(), "..", "..", ...segments);
}

function asTerms(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((term) => String(term).trim()).filter(Boolean);
}

function summarizeTimings(timings: Array<{ text: string; start: number; end: number }>, limit = 8) {
  const sample = timings.slice(0, limit).map((timing) => ({
    text: timing.text,
    startMs: timing.start,
    endMs: timing.end,
    durationMs: timing.end - timing.start,
  }));
  return {
    count: timings.length,
    firstStartMs: timings[0]?.start,
    lastEndMs: timings.at(-1)?.end,
    sample,
  };
}

function isBatchTimingDebugEnabled() {
  return process.env.BATCH_DEBUG_TIMING === "1";
}

export function resolveBatchScript(item: BatchItemInput) {
  return (item.script || "").trim();
}

export function resolveBatchTerms(input: BatchTermsInput) {
  const subject = (input.subject || "").trim();
  if (input.searchMode === "subject") return [subject].filter(Boolean);
  if (input.searchMode === "script") return [input.resolvedScript].filter(Boolean);

  const explicit = asTerms(input.terms);
  if (explicit.length) return explicit;
  if (subject) return [subject];
  return [input.resolvedScript].filter(Boolean);
}

function contentTypeForPath(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".mov") return "video/quicktime";
  if (ext === ".webm") return "video/webm";
  return "application/octet-stream";
}

async function uploadLocalFile(filePath: string, objectKey: string) {
  const body = await fs.readFile(filePath);
  const result = await minioStorage.putObject({
    objectKey,
    body,
    contentType: contentTypeForPath(filePath),
  });
  return result.publicUrl;
}

async function firstLocalBgmUrl(batchId: string, itemId: string, settings: BatchSettings) {
  if (settings.bgm.source === "none" || settings.bgm.source === "uploaded") return undefined;
  if (settings.bgm.source === "custom") {
    if (!settings.bgm.file) return undefined;
    return await uploadLocalFile(rootPath(settings.bgm.file), `batch/${batchId}/${itemId}/bgm-${path.basename(settings.bgm.file)}`);
  }

  const directory = rootPath(settings.bgm.directory);
  const files = await fs.readdir(directory).catch(() => []);
  const mp3s = files.filter((file) => /\.mp3$/i.test(file));
  const mp3 = settings.bgm.source === "random" ? mp3s[Math.floor(Math.random() * mp3s.length)] : mp3s[0];
  if (!mp3) return undefined;
  return await uploadLocalFile(path.join(directory, mp3), `batch/${batchId}/${itemId}/bgm-${mp3}`);
}

async function resolveMaterials(terms: string[], settings: BatchSettings): Promise<VideoMaterial[]> {
  if (settings.materials.source === "local" && settings.materials.uploadedUrls.length) {
    return settings.materials.uploadedUrls.map((url) => ({ provider: "local" as const, url, duration: 0 }));
  }

  const providers = chooseMaterialProvider(settings.materials.source);
  const materials: VideoMaterial[] = [];

  for (const provider of providers) {
    if (provider === "local") {
      materials.push(...(await listLocalVideos(rootPath(settings.materials.localDirectory))));
    }

    if (provider === "pexels") {
      for (const term of terms) {
        materials.push(...(await searchPexelsVideos(term, settings.video.aspectRatio, settings.video.clipDuration)));
        if (materials.length) break;
      }
    }

    if (provider === "pixabay") {
      for (const term of terms) {
        materials.push(...(await searchPixabayVideos(term, settings.video.aspectRatio, settings.video.clipDuration)));
        if (materials.length) break;
      }
    }

    if (materials.length) break;
  }

  return materials;
}

async function publicVideoUrls(batchId: string, itemId: string, materials: VideoMaterial[]) {
  const urls: string[] = [];
  for (const material of materials) {
    if (material.provider === "local" && !/^https?:\/\//i.test(material.url)) {
      const fileName = path.basename(material.url);
      urls.push(await uploadLocalFile(material.url, `batch/${batchId}/${itemId}/video-${fileName}`));
    } else {
      urls.push(material.url);
    }
  }
  return urls;
}

export async function startBatchRun(batchId: string) {
  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    include: { items: { orderBy: { order: "asc" } } },
  });
  if (!batch) throw new Error("Batch not found.");

  const settings = normalizeBatchSettings(batch.settings);
  await prisma.batch.update({
    where: { id: batch.id },
    data: { status: "QUEUED" },
  });

  const queue = createRenderQueue();
  try {
    for (const item of batch.items) {
      try {
        // Resolve script and terms first
        const resolvedScript = resolveBatchScript(item);
        if (!resolvedScript) throw new Error("Batch item needs a script. Generate or enter script before starting.");
        const resolvedTerms = resolveBatchTerms({
          subject: item.subject,
          resolvedScript,
          terms: item.terms,
          searchMode: settings.materials.searchMode,
        });

        await prisma.batchItem.update({
          where: { id: item.id },
          data: {
            resolvedScript,
            resolvedTerms: toJson(resolvedTerms),
            statusDetail: "生成语音中...",
            progress: 25,
          },
        });

        // Generate one TTS for the entire script
        const ttsResult = await createEdgeTtsAudio({
          script: resolvedScript,
          voice: settings.tts.voice,
          rate: settings.tts.rate,
          outputDir: rootPath("cache", "batch", batch.id, item.id),
        });
        const audioUrl = await uploadLocalFile(ttsResult.path, `batch/${batch.id}/${item.id}/audio.mp3`);
        const subtitleTimings = ttsResult.subtitleTimings || [];

        console.log(`[batch:${item.id}] TTS duration: ${ttsResult.duration}s, subtitle timings: ${subtitleTimings.length} entries`);
        if (isBatchTimingDebugEnabled()) {
          console.log(
            `[batch:${item.id}] TTS detail ${JSON.stringify({
              voice: settings.tts.voice,
              rate: settings.tts.rate,
              scriptChars: resolvedScript.length,
              scriptPreview: resolvedScript.slice(0, 120),
              audioDurationSecFromSubtitleJson: ttsResult.duration,
              subtitleTimingSummary: summarizeTimings(subtitleTimings),
            })}`,
          );
        }

        await prisma.batchItem.update({
          where: { id: item.id },
          data: { statusDetail: `语音生成完成，搜索素材中: ${resolvedTerms.slice(0, 3).join(", ")}...`, progress: 45 },
        });

        const materials = await resolveMaterials(resolvedTerms, settings);
        if (!materials.length) {
          throw new Error("No usable video materials found. Add local videos or choose Pexels/Pixabay.");
        }

        const videoUrls = await publicVideoUrls(batch.id, item.id, materials.slice(0, 6));
        const bgmUrl = await firstLocalBgmUrl(batch.id, item.id, settings);

        console.log(`[batch:${item.id}] Video count: ${videoUrls.length}, clipDuration: ${settings.video.clipDuration}s`);

        await prisma.batchItem.update({
          where: { id: item.id },
          data: {
            statusDetail: `找到 ${videoUrls.length} 个视频素材，提交渲染...`,
            progress: 55,
            materials: toJson(videoUrls.map((url, i) => ({
              url,
              provider: materials[i]?.provider || "unknown",
              keyword: resolvedTerms[Math.min(i, resolvedTerms.length - 1)] || "",
            }))),
          },
        });

        const renderInputs = buildRenderInputsForBatchItem({
          batchId: batch.id,
          batchItemId: item.id,
          userId: batch.userId ?? undefined,
          title: item.subject || batch.title,
          script: resolvedScript,
          audioUrl,
          audioDuration: ttsResult.duration,
          subtitleTimings,
          videoUrls,
          bgmUrl,
          settings,
        });
        if (isBatchTimingDebugEnabled()) {
          for (const renderInput of renderInputs) {
            console.log(
              `[batch:${item.id}] Render input timing ${JSON.stringify({
                outputIndex: renderInput.batchOutputIndex,
                clipDurationSec: settings.video.clipDuration,
                videoCount: renderInput.items.length,
                narrationDurationSec: renderInput.narration_audio?.duration,
                narrationSubtitleTimings: summarizeTimings(renderInput.narration_audio?.subtitleTimings ?? []),
                transitionEnabled: settings.video.transition.enabled,
                transitionStyle: settings.video.transition.style ?? null,
                subtitleEnabled: settings.subtitle.enabled,
                scenePayloads: renderInput.items.map((scene, sceneIndex) => ({
                  sceneIndex,
                  videoDurationSec: scene.video?.duration,
                  fallbackSubtitlePreview: scene.sub_title?.text.slice(0, 80),
                  hasPerSceneAudio: Boolean(scene.audio?.length),
                })),
              })}`,
            );
          }
        }

        for (const renderInput of renderInputs) {
          const job = await prisma.job.create({
            data: {
              type: "batch.video",
              userId: batch.userId,
              batchItemId: item.id,
              input: toJson(renderInput),
            },
          });
          await prisma.job.update({
            where: { id: job.id },
            data: { queueId: job.id },
          });
          await queue.add("quick-concat", renderInput, { jobId: job.id });
        }

        await prisma.batchItem.update({
          where: { id: item.id },
          data: { status: "QUEUED", statusDetail: "渲染队列中，等待 worker 处理...", progress: 65 },
        });
      } catch (error) {
        await prisma.batchItem.update({
          where: { id: item.id },
          data: {
            status: "FAILED",
            error: error instanceof Error ? error.message : String(error),
            finishedAt: new Date(),
          },
        });
      }
    }
  } finally {
    await queue.close();
  }

  // Update batch status to ACTIVE after all items are queued
  await prisma.batch.update({
    where: { id: batchId },
    data: { status: "ACTIVE" },
  });

  return await prisma.batch.findUnique({
    where: { id: batchId },
    include: {
      items: {
        orderBy: { order: "asc" },
        include: { outputs: { orderBy: { createdAt: "asc" } }, jobs: true },
      },
    },
  });
}
