import type { RenderJobInput } from "@/server/queue/adapter";
import type { SubtitleTiming } from "./edge-tts";
import type { BatchSettings } from "./settings";

function splitScriptForSubtitles(script: string, sceneCount: number) {
  const normalized = script.replace(/\s+/g, " ").trim();
  if (!normalized || sceneCount <= 0) return [];

  const sentences = normalized.match(/[^。！？!?]+[。！？!?]?/g)?.map((part) => part.trim()).filter(Boolean) ?? [normalized];
  if (sentences.length <= sceneCount) return sentences;

  const groups = Array.from({ length: sceneCount }, () => "");
  sentences.forEach((sentence, index) => {
    const groupIndex = Math.min(sceneCount - 1, Math.floor((index * sceneCount) / sentences.length));
    groups[groupIndex] = `${groups[groupIndex]}${sentence}`.trim();
  });
  return groups.filter(Boolean);
}

export function buildRenderInputsForBatchItem(input: {
  batchId?: string;
  batchItemId: string;
  userId?: string;
  title: string;
  script: string;
  audioUrl: string;
  audioDuration?: number;
  subtitleTimings?: SubtitleTiming[];
  videoUrls: string[];
  bgmUrl?: string;
  settings: BatchSettings;
}): RenderJobInput[] {
  const videoItems = input.videoUrls.length ? input.videoUrls : [""];
  const clipDuration = input.settings.video.clipDuration;

  return Array.from({ length: input.settings.video.outputsPerItem }, (_, index) => {
    const orderedVideos =
      input.settings.video.concatMode === "random" ? [...videoItems].sort(() => Math.random() - 0.5) : videoItems;
    const videoCount = orderedVideos.filter(Boolean).length;
    const requiredVideoCount =
      input.audioDuration && clipDuration > 0
        ? Math.max(videoCount, Math.ceil(input.audioDuration / clipDuration))
        : videoCount;
    const renderVideos =
      videoCount > 0
        ? Array.from({ length: requiredVideoCount }, (_, videoIndex) => orderedVideos[videoIndex % videoCount])
        : [];

    // Split script into sentences matching video count
    const subtitles = splitScriptForSubtitles(input.script, renderVideos.length);

    return {
      batchId: input.batchId,
      batchItemId: input.batchItemId,
      batchOutputIndex: index + 1,
      userId: input.userId,
      title: input.title,
      narration_audio: {
        url: input.audioUrl,
        text: input.script,
        ...(input.audioDuration ? { duration: input.audioDuration } : {}),
        ...(input.subtitleTimings?.length ? { subtitleTimings: input.subtitleTimings } : {}),
      },
      items: renderVideos.filter(Boolean).map((url, itemIndex) => ({
        video: { url, duration: clipDuration },
        sub_title: { text: subtitles[itemIndex] ?? input.script },
      })),
      bg_audios: input.bgmUrl ? [{ url: input.bgmUrl, volume: input.settings.bgm.volume }] : undefined,
      aspect_ratio: input.settings.video.aspectRatio,
      resolution: input.settings.video.resolution,
      input_parameter: {
        advancedParameters: {
          isGenerateSubtitle: input.settings.subtitle.enabled ? "yes" : "no",
          isGenerateSubtitleAnimation: "no",
          isGenerateTransition: input.settings.video.transition.enabled ? "yes" : "no",
          isGenerateVideoEffect: "yes",
          ...(input.settings.video.transition.enabled && input.settings.video.transition.style
            ? { transitionStyle: input.settings.video.transition.style }
            : {}),
        },
      },
    };
  });
}
