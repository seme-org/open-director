export type CreationAsset = {
  id: string;
  blockId?: string | null;
  title: string;
  type: string;
  url: string | null;
  metadata: unknown;
};

export type CreationToolCall = {
  id: string;
  name: string;
  status: string;
};

export type CreationBlock = {
  id: string;
  order: number;
  title: string;
  script: string | null;
  visualPrompt: string | null;
  audioPrompt: string | null;
  metadata?: unknown;
};

export type CreationExportPreset = {
  title: { enabled: boolean; style?: string };
  titleAnimation: { enabled: boolean; name?: string };
  subtitle: { enabled: boolean; style?: string };
  subtitleAnimation: { enabled: boolean; name?: string };
  effect: { enabled: boolean; style?: string };
  transition: { enabled: boolean; style?: string };
};

export type CreationExportPayload = {
  threadId: string;
  title: string;
  aspect_ratio: string;
  resolution: 480 | 720 | 1080;
  items: Array<{
    audio?: Array<{ url: string; text?: string; duration?: number }>;
    image?: { url: string };
    video?: { url: string; duration?: number };
    sub_title?: { text: string };
  }>;
  bg_audios?: Array<{ url: string; volume?: number }>;
  input_parameter: {
    advancedParameters: {
      isGenerateTitle: "yes" | "no";
      isGenerateTitleAnimation: "yes" | "no";
      isGenerateSubtitle: "yes" | "no";
      isGenerateSubtitleAnimation: "yes" | "no";
      isGenerateVideoEffect: "yes" | "no";
      isGenerateTransition: "yes" | "no";
      titleStyle?: string;
      subtitleStyle?: string;
      titleAnimation?: string;
      subtitleAnimation?: string;
      videoEffectStyle?: string;
      transitionStyle?: string;
    };
  };
};

export type StoryboardAssetGroup = {
  blockId: string;
  block: CreationBlock;
  visualAssets: CreationAsset[];
  voiceAssets: CreationAsset[];
  displayAsset?: CreationAsset;
};

export type StoryboardAssetGroups = StoryboardAssetGroup[] & {
  musicAssets: CreationAsset[];
};

export type CreationPreparationStatus = {
  totalBlocks: number;
  readyVisuals: number;
  readyVoices: number;
  readyMusic: number;
  hasRunningTasks: boolean;
  hasFailedTasks: boolean;
  isComplete: boolean;
  blockStatuses: Array<{
    blockId: string;
    visual: "pending" | "completed";
    voice: "pending" | "completed";
  }>;
};

export type PreviewBgmTrack = {
  id: string;
  title: string;
  url: string;
  startSeconds: number;
  durationSeconds: number;
  volume: number;
};

export type ExportStatus = "idle" | "exporting" | "success" | "error";

export type CreationExportState = {
  status: ExportStatus;
  progress: number;
  message: string;
  jobId?: string;
  videoUrl?: string;
};

export type JobLike = {
  id: string;
  status: "QUEUED" | "ACTIVE" | "COMPLETED" | "FAILED" | string;
  progress: number | null;
  output: unknown;
  error?: string | null;
  renderOutputs?: Array<{ url: string }>;
  queue?: {
    state?: string | null;
    position?: number | null;
    total?: number | null;
  } | null;
};

export function resolveCreationAspectRatio(recipe: unknown) {
  const record = asRecord(recipe);
  const value = String(record.aspectRatio ?? record.aspect_ratio ?? "");
  return ["16:9", "9:16", "1:1"].includes(value) ? value : "16:9";
}

export const defaultCreationExportPreset: CreationExportPreset = {
  title: { enabled: true },
  titleAnimation: { enabled: true },
  subtitle: { enabled: true },
  subtitleAnimation: { enabled: true },
  effect: { enabled: true },
  transition: { enabled: true },
};

export function buildResourcePreloadKey(assets: CreationAsset[]) {
  const urls = assets.map((asset) => asset.url).filter((url): url is string => Boolean(url)).sort();
  return JSON.stringify(urls);
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function taskTool(asset: CreationAsset) {
  const raw = asRecord(asRecord(asset.metadata).task).tool ?? "";
  // Strip surrounding quotes if present (MySQL JSON returns quoted strings)
  const str = String(raw);
  return str.startsWith('"') && str.endsWith('"') ? str.slice(1, -1) : str;
}

function assetShotId(asset: CreationAsset) {
  return textValue(asRecord(asRecord(asset.metadata).task).shotId);
}

function blockShotId(block: CreationBlock) {
  return textValue(asRecord(block.metadata).shotId);
}

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function getCreationAssetDuration(asset: CreationAsset) {
  const metadata = asRecord(asset.metadata);
  return numberValue(metadata.duration ?? metadata.durationSeconds ?? metadata.duration_seconds ?? asRecord(metadata.task).duration);
}

function metadataText(asset: CreationAsset, fallback: string) {
  const metadata = asRecord(asset.metadata);
  return textValue(metadata.text ?? metadata.prompt_text ?? asRecord(metadata.task).text, fallback);
}

export function selectVisualAssets(assets: CreationAsset[]) {
  const sourceFrames = assets.filter((asset) => asset.type === "IMAGE" && taskTool(asset) === "image_to_image" && asset.url);
  const imageAssets = assets.filter((asset) => asset.type === "IMAGE" && asset.url);
  return sourceFrames.length ? sourceFrames : imageAssets;
}

function isVoiceAsset(asset: CreationAsset) {
  if (asset.type !== "AUDIO" || !asset.url) return false;
  const tool = taskTool(asset);
  if (tool === "tts_create") return true;
  if (asset.blockId) return true;
  // Fallback: check if metadata has task with tts_create or shotId
  const meta = asRecord(asset.metadata);
  const task = asRecord(meta.task);
  if (String(task.tool ?? "") === "tts_create") return true;
  if (task.shotId) return true;
  return false;
}

function isMusicAsset(asset: CreationAsset) {
  const tool = taskTool(asset);
  return asset.type === "AUDIO" && asset.url && (tool === "text_to_bgm" || tool === "text_to_music" || (!asset.blockId && /bgm|music/i.test(asset.title)));
}

export function buildCreationPreparationStatus({
  blocks,
  assets,
  toolCalls = [],
}: {
  blocks: CreationBlock[];
  assets: CreationAsset[];
  toolCalls?: CreationToolCall[];
}): CreationPreparationStatus {
  const groups = buildStoryboardAssetGroups(blocks, assets);
  const blockStatuses = groups.map((group) => ({
    blockId: group.blockId,
    visual: group.visualAssets.length ? "completed" as const : "pending" as const,
    voice: group.voiceAssets.length ? "completed" as const : "pending" as const,
  }));
  const runningStatuses = new Set(["PENDING", "RUNNING"]);
  const failedStatuses = new Set(["FAILED"]);
  return {
    totalBlocks: blocks.length,
    readyVisuals: blockStatuses.filter((status) => status.visual === "completed").length,
    readyVoices: blockStatuses.filter((status) => status.voice === "completed").length,
    readyMusic: groups.musicAssets.length,
    hasRunningTasks: toolCalls.some((call) => runningStatuses.has(call.status)),
    hasFailedTasks: toolCalls.some((call) => failedStatuses.has(call.status)),
    isComplete: Boolean(blocks.length) && blockStatuses.every((status) => status.visual === "completed" && status.voice === "completed") && groups.musicAssets.length > 0,
    blockStatuses,
  };
}

export function buildCreationAssetsPollIntervalMs({ isComplete }: { isComplete: boolean }) {
  return isComplete ? null : 2500;
}

export function buildStoryboardAssetGroups(blocks: CreationBlock[], assets: CreationAsset[]): StoryboardAssetGroups {
  const visualAssets = assets.filter((asset) => {
    if (asset.type !== "IMAGE" || !asset.url) return false;
    const tool = taskTool(asset);
    return tool === "image_to_image";
  });
  const voiceAssets = assets.filter(isVoiceAsset);
  const unassignedVisualAssets = visualAssets.filter((asset) => !asset.blockId && !assetShotId(asset));
  const unassignedVoiceAssets = voiceAssets.filter((asset) => !asset.blockId && !assetShotId(asset));
  const groups = blocks.map((block) => {
    const blockIndex = Math.max(0, block.order - 1);
    const shotId = blockShotId(block);
    const blockVisualAssets = visualAssets.filter((asset) => {
      if (asset.blockId === block.id) return true;
      if (!asset.blockId && shotId && assetShotId(asset) === shotId) return true;
      return false;
    });
    const blockVoiceAssets = voiceAssets.filter((asset) => {
      if (asset.blockId === block.id) return true;
      if (!asset.blockId && shotId && assetShotId(asset) === shotId) return true;
      // Fallback: match by sceneTitle from metadata
      const meta = asRecord(asset.metadata);
      const task = asRecord(meta.task);
      const assetSceneTitle = String(task.sceneTitle ?? asset.title ?? "");
      if (assetSceneTitle && block.title && assetSceneTitle.includes(block.title)) return true;
      return false;
    });
    const visualCandidates = blockVisualAssets.length ? blockVisualAssets : unassignedVisualAssets[blockIndex] ? [unassignedVisualAssets[blockIndex]] : [];
    const voiceCandidates = blockVoiceAssets.length ? blockVoiceAssets : unassignedVoiceAssets[blockIndex] ? [unassignedVoiceAssets[blockIndex]] : [];
    return {
      blockId: block.id,
      block,
      visualAssets: visualCandidates,
      voiceAssets: voiceCandidates,
      displayAsset: visualCandidates[0],
    };
  }) as StoryboardAssetGroups;
  groups.musicAssets = assets.filter(isMusicAsset);
  return groups;
}

export function getTimelineSeekSeconds({
  offsetX,
  timelineWidth,
  durationSeconds,
}: {
  offsetX: number;
  timelineWidth: number;
  durationSeconds: number;
}) {
  if (timelineWidth <= 0 || durationSeconds <= 0) return 0;
  const progress = Math.max(0, Math.min(1, offsetX / timelineWidth));
  return Math.round(progress * durationSeconds * 100) / 100;
}

export function shouldShowPreviewTitle({
  elapsedSeconds,
  titleWindowSeconds = 4.05,
}: {
  elapsedSeconds: number;
  titleWindowSeconds?: number;
}) {
  return Math.max(0, elapsedSeconds) < titleWindowSeconds;
}

export function formatExportProgressLabel(progress: number) {
  const safeProgress = Number.isFinite(progress) ? progress : 0;
  return `${Math.round(Math.max(0, Math.min(100, safeProgress)))}%`;
}

export function buildPreviewBgmTracks(musicAssets: CreationAsset[], durationSeconds: number): PreviewBgmTrack[] {
  const safeDuration = Math.max(0, durationSeconds);
  return musicAssets
    .filter((asset) => asset.url)
    .map((asset) => ({
    id: asset.id,
      title: asset.title,
      url: asset.url || "",
      startSeconds: 0,
    durationSeconds: safeDuration,
      volume: numberValue(asRecord(asset.metadata).volume) ?? 0.22,
    }));
}

export function getPreviewVoiceAsset(groups: StoryboardAssetGroups, blockIndex: number) {
  return groups[blockIndex]?.voiceAssets[0];
}

export function getStoryboardPreviewDurations(groups: StoryboardAssetGroups, fallbackSeconds: number) {
  const fallback = Math.max(0.1, fallbackSeconds);
  return groups.map((group) => {
    const duration = group.voiceAssets[0] ? getCreationAssetDuration(group.voiceAssets[0]) : undefined;
    return duration && duration > 0 ? duration : fallback;
  });
}

export function applyAssetDurationMeasurement(assets: CreationAsset[], assetId: string, durationSeconds: number): CreationAsset[] {
  const duration = numberValue(durationSeconds);
  if (!duration || duration <= 0) return assets;
  let changed = false;
  const nextAssets = assets.map((asset) => {
    if (asset.id !== assetId) return asset;
    const previousMetadata = asRecord(asset.metadata);
    const previousDuration = getCreationAssetDuration(asset);
    if (previousDuration && Math.abs(previousDuration - duration) < 0.01) return asset;
    changed = true;
    return {
      ...asset,
      metadata: {
        ...previousMetadata,
        duration,
      },
    };
  });
  return changed ? nextAssets : assets;
}

export function mergePolledCreationAssets(currentAssets: CreationAsset[], polledAssets: CreationAsset[]): CreationAsset[] {
  const currentById = new Map(currentAssets.map((asset) => [asset.id, asset]));
  let changed = currentAssets.length !== polledAssets.length;
  const merged = polledAssets.map((asset, index) => {
    const current = currentById.get(asset.id);
    if (!current) {
      changed = true;
      return asset;
    }
    const currentDuration = getCreationAssetDuration(current);
    const polledDuration = getCreationAssetDuration(asset);
    const nextAsset = currentDuration && !polledDuration
      ? {
          ...asset,
          metadata: {
            ...asRecord(asset.metadata),
            duration: currentDuration,
          },
        }
      : asset;
    if (currentAssets[index] !== nextAsset) changed = true;
    return nextAsset;
  });
  if (!changed) return currentAssets;
  return merged;
}

export function getVariablePreviewFrameIndex({
  elapsedSeconds,
  durations,
}: {
  elapsedSeconds: number;
  durations: number[];
}) {
  if (!durations.length) return 0;
  const safeElapsed = Math.max(0, elapsedSeconds);
  let cursor = 0;
  for (let index = 0; index < durations.length; index += 1) {
    const duration = Math.max(0.1, durations[index] ?? 0);
    if (safeElapsed < cursor + duration) return index;
    cursor += duration;
  }
  return durations.length - 1;
}

export function getStoryboardStartSeconds(durations: number[], blockIndex: number) {
  const clampedIndex = Math.max(0, Math.min(durations.length, blockIndex));
  return durations.slice(0, clampedIndex).reduce((total, duration) => total + Math.max(0.1, duration), 0);
}

export function getEqualStoryboardTimelineBlockWidths(blockCount: number, blockWidth: number) {
  const count = Math.max(0, Math.trunc(blockCount));
  const width = Math.max(1, Math.round(blockWidth));
  return Array.from({ length: count }, () => width);
}

export function getVariablePlayheadPosition({
  elapsedSeconds,
  durations,
  blockWidths,
  blockGap,
}: {
  elapsedSeconds: number;
  durations: number[];
  blockWidths: number[];
  blockGap: number;
}) {
  if (!durations.length) return 0;
  const index = getVariablePreviewFrameIndex({ elapsedSeconds, durations });
  const startSeconds = getStoryboardStartSeconds(durations, index);
  const startPixels = blockWidths.slice(0, index).reduce((total, width) => total + Math.max(0, width) + blockGap, 0);
  const duration = Math.max(0.1, durations[index] ?? 0);
  const width = Math.max(0, blockWidths[index] ?? 0);
  const localElapsed = Math.max(0, Math.min(duration, elapsedSeconds - startSeconds));
  const position = startPixels + (localElapsed / duration) * width;
  const totalWidth = blockWidths.reduce((total, width) => total + Math.max(0, width), 0) + Math.max(0, durations.length - 1) * blockGap;
  return Math.round(Math.max(0, Math.min(totalWidth, position)));
}

export function getVariableTimelineSeekSeconds({
  offsetX,
  durations,
  blockWidths,
  blockGap,
}: {
  offsetX: number;
  durations: number[];
  blockWidths: number[];
  blockGap: number;
}) {
  if (!durations.length) return 0;
  const safeOffset = Math.max(0, offsetX);
  let pixelCursor = 0;
  let secondCursor = 0;
  for (let index = 0; index < durations.length; index += 1) {
    const duration = Math.max(0.1, durations[index] ?? 0);
    const width = Math.max(1, blockWidths[index] ?? 1);
    const segmentEnd = pixelCursor + width;
    if (safeOffset <= segmentEnd) {
      const localProgress = Math.max(0, Math.min(1, (safeOffset - pixelCursor) / width));
      return Math.round((secondCursor + localProgress * duration) * 100) / 100;
    }
    pixelCursor = segmentEnd + blockGap;
    secondCursor += duration;
    if (safeOffset < pixelCursor) return Math.round(secondCursor * 100) / 100;
  }
  return Math.round(secondCursor * 100) / 100;
}

export function buildCreationExportPayload(input: {
  threadId: string;
  title: string;
  blocks: CreationBlock[];
  assets: CreationAsset[];
  resolution: 480 | 720 | 1080;
  aspectRatio: string;
  preset: CreationExportPreset;
}): CreationExportPayload {
  const storyboardGroups = buildStoryboardAssetGroups(input.blocks, input.assets);

  return {
    threadId: input.threadId,
    title: input.title,
    aspect_ratio: input.aspectRatio,
    resolution: input.resolution,
    items: storyboardGroups.map((group) => {
      const block = group.block;
      const visual = group.displayAsset;
      const audio = group.voiceAssets[0];
      const subtitleText = block.script || block.title;
      return {
        ...(visual?.url ? { image: { url: visual.url } } : {}),
        ...(audio?.url
          ? {
              audio: [
                {
                  url: audio.url,
                  text: metadataText(audio, subtitleText),
                  duration: getCreationAssetDuration(audio),
                },
              ],
            }
          : {}),
        ...(input.preset.subtitle.enabled ? { sub_title: { text: subtitleText } } : {}),
      };
    }),
    ...(storyboardGroups.musicAssets.length
      ? {
          bg_audios: storyboardGroups.musicAssets.map((asset) => ({
            url: asset.url || "",
            volume: numberValue(asRecord(asset.metadata).volume) ?? 0.22,
          })),
        }
      : {}),
    input_parameter: {
      advancedParameters: {
        isGenerateTitle: input.preset.title.enabled ? "yes" : "no",
        isGenerateTitleAnimation: input.preset.titleAnimation.enabled ? "yes" : "no",
        isGenerateSubtitle: input.preset.subtitle.enabled ? "yes" : "no",
        isGenerateSubtitleAnimation: input.preset.subtitleAnimation.enabled ? "yes" : "no",
        isGenerateVideoEffect: input.preset.effect.enabled ? "yes" : "no",
        isGenerateTransition: input.preset.transition.enabled ? "yes" : "no",
        ...(input.preset.title.enabled && input.preset.title.style ? { titleStyle: input.preset.title.style } : {}),
        ...(input.preset.subtitle.enabled && input.preset.subtitle.style ? { subtitleStyle: input.preset.subtitle.style } : {}),
        ...(input.preset.titleAnimation.enabled && input.preset.titleAnimation.name ? { titleAnimation: input.preset.titleAnimation.name } : {}),
        ...(input.preset.subtitleAnimation.enabled && input.preset.subtitleAnimation.name ? { subtitleAnimation: input.preset.subtitleAnimation.name } : {}),
        ...(input.preset.effect.enabled && input.preset.effect.style ? { videoEffectStyle: input.preset.effect.style } : {}),
        ...(input.preset.transition.enabled && input.preset.transition.style ? { transitionStyle: input.preset.transition.style } : {}),
      },
    },
  };
}

export function mapJobToExportState(job: JobLike): CreationExportState {
  if (job.status === "COMPLETED") {
    const outputUrl = textValue(asRecord(job.output).url);
    return {
      status: "success",
      progress: 100,
      message: "Export completed",
      jobId: job.id,
      videoUrl: outputUrl || job.renderOutputs?.[0]?.url,
    };
  }

  if (job.status === "FAILED") {
    return {
      status: "error",
      progress: Number(job.progress || 0),
      message: job.error || "Export failed",
      jobId: job.id,
    };
  }

  return {
    status: "exporting",
    progress: Math.max(0, Math.min(99, Number(job.progress || 0))),
    message:
      job.queue?.state === "waiting"
        ? `Waiting for render worker${
            job.queue.position && job.queue.total
              ? ` (queue position ${job.queue.position}/${job.queue.total})`
              : ""
          }`
        : job.status === "QUEUED" ? "Queued for rendering" : "Rendering video",
    jobId: job.id,
  };
}

export function getPreviewFrameIndex({
  elapsedSeconds,
  blockCount,
  secondsPerBlock,
}: {
  elapsedSeconds: number;
  blockCount: number;
  secondsPerBlock: number;
}) {
  if (blockCount <= 0) return 0;
  const safeSecondsPerBlock = Math.max(0.1, secondsPerBlock);
  const index = Math.floor(Math.max(0, elapsedSeconds) / safeSecondsPerBlock);
  return Math.max(0, Math.min(blockCount - 1, index));
}

export function getPlayheadPosition({
  elapsedSeconds,
  blockCount,
  secondsPerBlock,
  blockWidth,
  blockGap,
}: {
  elapsedSeconds: number;
  blockCount: number;
  secondsPerBlock: number;
  blockWidth: number;
  blockGap: number;
}) {
  if (blockCount <= 0) return 0;
  const index = getPreviewFrameIndex({ elapsedSeconds, blockCount, secondsPerBlock });
  const localElapsed = Math.max(0, Math.min(secondsPerBlock, elapsedSeconds - index * secondsPerBlock));
  const progress = Math.max(0, Math.min(1, localElapsed / Math.max(0.1, secondsPerBlock)));
  const position = index * (blockWidth + blockGap) + progress * blockWidth;
  return Math.round(Math.max(0, Math.min(blockCount * (blockWidth + blockGap) - blockGap, position)));
}
