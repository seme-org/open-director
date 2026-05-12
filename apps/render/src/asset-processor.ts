import path from "node:path";
import { v4 as uuidv4 } from "uuid";
import fs from "fs-extra";
import ffmpeg from "fluent-ffmpeg";
import type { AssetItem, AudioAsset } from "./types.js";
import { downloadFile, probeMedia, processAudioSpeed } from "./utils.js";
import { cacheDir } from "./config.js";
import { cleanupFiles } from "./cleanup.js";

function sortAudioByOrder<T extends { order?: number }>(
  arr: T[] | undefined,
): T[] | undefined {
  if (!arr || arr.length === 0) return arr;
  const hasAnyOrder = arr.some((a) => Number.isFinite(a.order));
  if (!hasAnyOrder) return arr;
  return arr
    .map((v, i) => ({ v, i }))
    .sort((a, b) => {
      const ao = Number.isFinite(a.v.order)
        ? (a.v.order as number)
        : Number.POSITIVE_INFINITY;
      const bo = Number.isFinite(b.v.order)
        ? (b.v.order as number)
        : Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      return a.i - b.i;
    })
    .map((x) => x.v);
}

function summarizeSubtitleTimings(timings: AudioAsset["subtitleTimings"], limit = 8) {
  const entries = timings ?? [];
  return {
    count: entries.length,
    firstStartMs: entries[0]?.start,
    lastEndMs: entries.at(-1)?.end,
    sample: entries.slice(0, limit).map((timing) => ({
      text: timing.text,
      startMs: timing.start,
      endMs: timing.end,
      durationMs: timing.end - timing.start,
    })),
  };
}

function isTimingDebugEnabled() {
  return process.env.BATCH_DEBUG_TIMING === "1" || process.env.RENDER_DEBUG_TIMING === "1";
}

async function mapWithConcurrency<T, R>(
  arr: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(arr.length);
  const limit = Math.max(1, Math.floor(concurrency));
  let cursor = 0;

  async function worker() {
    while (true) {
      const currentIndex = cursor;
      cursor += 1;
      if (currentIndex >= arr.length) return;
      results[currentIndex] = await mapper(arr[currentIndex], currentIndex);
    }
  }

  const workers = new Array(Math.min(limit, arr.length))
    .fill(null)
    .map(() => worker());
  await Promise.all(workers);
  return results;
}

function runFfmpegConcat(
  listFilePath: string,
  outputPath: string,
  useStreamCopy: boolean,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg()
      .input(listFilePath)
      .inputOptions(["-f concat", "-safe 0"])
      .outputOptions(["-y"]);

    if (useStreamCopy) {
      cmd.outputOptions(["-c copy"]);
    } else {
      cmd.audioCodec("libmp3lame");
    }

    cmd
      .on("end", () => resolve(outputPath))
      .on("error", (err) => reject(err))
      .save(outputPath);
  });
}

async function concatAudioFiles(
  audioPaths: string[],
  workDir: string,
  taskId: string,
  itemIndex: number,
  tempFiles: string[],
): Promise<string> {
  if (audioPaths.length === 1) return audioPaths[0];

  const listFilePath = path.join(workDir, `${uuidv4()}_concat.txt`);
  const outputPath = path.join(workDir, `${uuidv4()}_concat.mp3`);

  tempFiles.push(listFilePath, outputPath);

  const content = audioPaths
    .map((p) => {
      const normalized = p.replace(/\\/g, "/");
      const escaped = normalized.replace(/'/g, "\\'");
      return `file '${escaped}'`;
    })
    .join("\n");

  await fs.outputFile(listFilePath, content, "utf8");

  try {
    await runFfmpegConcat(listFilePath, outputPath, true);
  } catch {
    await runFfmpegConcat(listFilePath, outputPath, false);
  }

  return outputPath;
}

export async function prepareAssets(
  items: AssetItem[],
  bg_audios: { url: string; volume?: number }[] | undefined,
  narration_audio: AudioAsset | undefined,
  taskId: string,
) {
  const taskCacheDir = path.join(cacheDir, taskId);
  await fs.ensureDir(taskCacheDir);

  const tempFiles: string[] = [];
  const bgAudios: Array<{ path: string; volume?: number }> = [];
  let narrationAudio:
    | {
        path: string;
        text?: string;
        duration?: number;
        subtitleTimings?: AudioAsset["subtitleTimings"];
      }
    | undefined;
  const processedItems: AssetItem[] = [];

  try {
    if (bg_audios && bg_audios.length > 0) {
      const downloadedBg = await mapWithConcurrency(bg_audios, 3, async (bg) => {
        try {
          const p = await downloadFile(bg.url, taskCacheDir);
          return { path: p, volume: bg.volume };
        } catch {
          return null;
        }
      });

      for (const bg of downloadedBg) {
        if (bg) bgAudios.push(bg);
      }
    }

    if (narration_audio?.url) {
      const narrationPath = await downloadFile(narration_audio.url, taskCacheDir);
      let duration = narration_audio.duration;
      let probedDuration: number | undefined;
      if (!duration) {
        try {
          const metadata = await probeMedia(narrationPath);
          probedDuration = Number(metadata?.format?.duration ?? 0) || undefined;
          duration = probedDuration;
        } catch {}
      } else {
        try {
          const metadata = await probeMedia(narrationPath);
          probedDuration = Number(metadata?.format?.duration ?? 0) || undefined;
        } catch {}
      }
      narrationAudio = {
        path: narrationPath,
        text: narration_audio.text,
        duration,
        subtitleTimings: narration_audio.subtitleTimings,
      };
      if (isTimingDebugEnabled()) {
        console.log(
          `[render:${taskId}] Narration audio detail ${JSON.stringify({
            payloadDurationSec: narration_audio.duration,
            probedDurationSec: probedDuration,
            effectiveDurationSec: duration,
            textChars: narration_audio.text?.length ?? 0,
            textPreview: narration_audio.text?.slice(0, 120) ?? "",
            subtitleTimingSummary: summarizeSubtitleTimings(narration_audio.subtitleTimings),
          })}`,
        );
      }
    }

    const perItem = await mapWithConcurrency(items, 2, async (item, index) => {
      const itemIndex = index + 1;
      const audioPaths: string[] = [];
      const audioDurations: number[] = [];
      let audioPath: string | undefined;
      let videoPath: string | undefined;
      let imagePath: string | undefined;

      const visualPromise = (async () => {
        if (item.video) {
          const p = await downloadFile(item.video.url, taskCacheDir);
          return { videoPath: p, imagePath: undefined };
        }
        if (item.image) {
          const p = await downloadFile(item.image.url, taskCacheDir);
          return { videoPath: undefined, imagePath: p };
        }
        return { videoPath: undefined, imagePath: undefined };
      })();

      const audioPromise = (async () => {
        if (!item.audio || item.audio.length === 0) return;
        const audios = sortAudioByOrder(item.audio) ?? item.audio;

        const downloadableAudios = audios.filter((audio) => audio.url);
        const downloaded = await mapWithConcurrency(downloadableAudios, 4, async (audio) => {
          return await downloadFile(audio.url!, taskCacheDir);
        });

        for (const p of downloaded) {
          audioPaths.push(p);
        }

        const metas = await Promise.all(
          downloaded.map(async (p) => {
            try {
              return await probeMedia(p);
            } catch {
              return null;
            }
          }),
        );

        for (let audioIndex = 0; audioIndex < audios.length; audioIndex++) {
          const audio = audios[audioIndex];
          if (audio.duration) {
            audioDurations.push(audio.duration);
            continue;
          }
          const downloadIndex = downloadableAudios.indexOf(audio);
          const meta = downloadIndex >= 0 ? metas[downloadIndex] : null;
          audioDurations.push(Number(meta?.format?.duration ?? 0));
        }
        if (audioPaths.length > 0) {
          audioPath = await concatAudioFiles(
            audioPaths,
            taskCacheDir,
            taskId,
            itemIndex,
            tempFiles,
          );
        }
      })();

      const [{ videoPath: v, imagePath: i }] = await Promise.all([
        visualPromise,
        audioPromise,
      ]);

      videoPath = v;
      imagePath = i;

      let videoDuration = 0;
      let audioDuration = 0;
      let probedW = 0;
      let probedH = 0;

      if (videoPath) {
        try {
          const metadata = await probeMedia(videoPath);
          if (metadata?.format?.duration) {
            videoDuration = Number(metadata.format.duration);
          }
          const videoStream = metadata?.streams?.find(
            (s) => s.codec_type === "video",
          );
          if (videoStream?.width && videoStream?.height) {
            probedW = videoStream.width;
            probedH = videoStream.height;
          }
        } catch {}
      } else if (imagePath) {
        try {
          const metadata = await probeMedia(imagePath);
          const videoStream = metadata?.streams?.find(
            (s) => s.codec_type === "video",
          );
          if (videoStream?.width && videoStream?.height) {
            probedW = videoStream.width;
            probedH = videoStream.height;
          }
        } catch {}
      }

      if (audioPaths.length > 0) {
        const allKnown = audioDurations.every((d) => d > 0);
        if (allKnown) {
          audioDuration = audioDurations.reduce((sum, d) => sum + d, 0);
        }
      }

      if (audioPath && audioDuration <= 0) {
        try {
          const metadata = await probeMedia(audioPath);
          if (metadata?.format?.duration) {
            audioDuration = Number(metadata.format.duration);
          }
        } catch {}
      }

      let audioSpeed: number | undefined;
      if (videoPath && videoDuration > 0 && audioPath && audioDuration > 0) {
        if (audioDuration > videoDuration) {
          const speed = audioDuration / videoDuration;
          audioSpeed = speed;

          const audioExt = path.extname(audioPath);
          const newAudioPath = path.join(
            taskCacheDir,
            `${uuidv4()}_sped${audioExt}`,
          );

          try {
            await processAudioSpeed(audioPath, newAudioPath, speed);
            tempFiles.push(newAudioPath);
            audioPath = newAudioPath;
            audioDuration = videoDuration;
          } catch {}
        }
      }

      return {
        ...item,
        audio: item.audio
          ? (sortAudioByOrder(item.audio) ?? item.audio)
          : item.audio,
        videoPath,
        imagePath,
        audioPaths: audioPaths.length > 0 ? audioPaths : undefined,
        audioDurations: audioDurations.length > 0 ? audioDurations : undefined,
        audioPath,
        audioSpeed,
        probedVideoDuration: videoDuration,
        probedAudioDuration: audioDuration,
        probedWidth: probedW,
        probedHeight: probedH,
      };
    });

    processedItems.push(...perItem);
    return { processedItems, tempFiles, bgAudios, narrationAudio };
  } catch (error) {
    await cleanupFiles(tempFiles);
    throw error;
  }
}

export function determineCanvasSize(
  processedItems: AssetItem[],
  aspectRatio: string | undefined,
  taskId: string,
  resolution?: 480 | 720 | 1080,
) {
  let width = 1920;
  let height = 1080;

  const firstVisualItem = processedItems.find(
    (item) => item.probedWidth && item.probedHeight,
  );
  if (
    firstVisualItem &&
    firstVisualItem.probedWidth &&
    firstVisualItem.probedHeight
  ) {
    width = firstVisualItem.probedWidth;
    height = firstVisualItem.probedHeight;
  } else {
    if (aspectRatio === "9:16") {
      width = 1080;
      height = 1920;
    }
  }

  const requestedResolution = resolution ?? 720;
  const targetLongSide =
    requestedResolution === 480
      ? 854
      : requestedResolution === 720
        ? 1280
        : 1920;

  const longSide = Math.max(width, height);
  const shortSide = Math.min(width, height);
  const scale = Math.min(
    1,
    targetLongSide / longSide,
    requestedResolution / shortSide,
  );

  if (scale < 1) {
    const nextW = Math.max(2, Math.round((width * scale) / 2) * 2);
    const nextH = Math.max(2, Math.round((height * scale) / 2) * 2);
    width = nextW;
    height = nextH;
  }

  return { width, height };
}
