import { describe, expect, it } from "vitest";
import { applyAssetDurationMeasurement, buildCreationExportPayload, buildCreationPreparationStatus, buildPreviewBgmTracks, buildCreationAssetsPollIntervalMs, buildResourcePreloadKey, buildStoryboardAssetGroups, defaultCreationExportPreset, formatExportProgressLabel, getEqualStoryboardTimelineBlockWidths, getPlayheadPosition, getPreviewFrameIndex, getPreviewVoiceAsset, getStoryboardPreviewDurations, getTimelineSeekSeconds, getVariablePlayheadPosition, getVariablePreviewFrameIndex, getVariableTimelineSeekSeconds, mapJobToExportState, mergePolledCreationAssets, resolveCreationAspectRatio, shouldShowPreviewTitle } from "./creation-export";
import { ANIMATION_EFFECTS, EFFECT_STYLES, SUBTITLE_STYLES, TITLE_STYLES, TRANSITION_STYLES } from "@/const/styleValue";

describe("buildCreationExportPayload", () => {
  it("includes export options, visual items, title, subtitles, and audio in the render payload", () => {
    const payload = buildCreationExportPayload({
      threadId: "thread-1",
      title: "Launch film",
      aspectRatio: "16:9",
      resolution: 1080,
      preset: {
        title: { enabled: true, style: "film_title" },
        titleAnimation: { enabled: true, name: "fadeIn" },
        subtitle: { enabled: true, style: "bold_caption" },
        subtitleAnimation: { enabled: false },
        effect: { enabled: true, style: "cinematic" },
        transition: { enabled: false, style: "fade" },
      },
      blocks: [
        { id: "block-1", order: 0, title: "Intro", script: "Hello world", visualPrompt: null, audioPrompt: null },
      ],
      assets: [
        { id: "image-1", blockId: "block-1", title: "Frame", type: "IMAGE", url: "https://cdn/image.png", metadata: { task: { tool: "image_to_image" } } },
        { id: "audio-1", blockId: "block-1", title: "Voice", type: "AUDIO", url: "https://cdn/audio.mp3", metadata: { duration: 3.5, text: "Hello world", task: { tool: "tts_create" } } },
        { id: "music-1", blockId: null, title: "BGM", type: "AUDIO", url: "https://cdn/bgm.mp3", metadata: { task: { tool: "text_to_bgm" } } },
      ],
    });

    expect(payload).toMatchObject({
      threadId: "thread-1",
      title: "Launch film",
      aspect_ratio: "16:9",
      resolution: 1080,
      items: [
        {
          image: { url: "https://cdn/image.png" },
          audio: [{ url: "https://cdn/audio.mp3", text: "Hello world", duration: 3.5 }],
          sub_title: { text: "Hello world" },
        },
      ],
      bg_audios: [{ url: "https://cdn/bgm.mp3", volume: 0.22 }],
      input_parameter: {
        advancedParameters: {
          isGenerateTitle: "yes",
          isGenerateTitleAnimation: "yes",
          isGenerateSubtitle: "yes",
          isGenerateSubtitleAnimation: "no",
          isGenerateVideoEffect: "yes",
          isGenerateTransition: "no",
          titleStyle: "film_title",
          subtitleStyle: "bold_caption",
          titleAnimation: "fadeIn",
          videoEffectStyle: "cinematic",
        },
      },
    });
  });
});

describe("resolveCreationAspectRatio", () => {
  it("uses the confirmed director brief aspect ratio stored on the recipe", () => {
    expect(resolveCreationAspectRatio({ aspectRatio: "9:16" })).toBe("9:16");
    expect(resolveCreationAspectRatio({ aspect_ratio: "1:1" })).toBe("1:1");
    expect(resolveCreationAspectRatio({})).toBe("16:9");
  });
});

describe("buildCreationPreparationStatus", () => {
  it("summarizes readiness from blocks, assets, and tool calls", () => {
    const status = buildCreationPreparationStatus({
      blocks: [
        { id: "block-1", order: 1, title: "第一幕", script: "台词", visualPrompt: "画面", audioPrompt: "声音" },
        { id: "block-2", order: 2, title: "第二幕", script: "台词", visualPrompt: "画面", audioPrompt: "声音" },
      ],
      assets: [
        { id: "asset-1", blockId: "block-1", title: "第一幕 - image_to_image", type: "IMAGE", url: "https://cdn.test/1.png", metadata: { task: { tool: "image_to_image" } } },
      ],
      toolCalls: [
        { id: "call-1", name: "image_to_image", status: "COMPLETED" },
        { id: "call-2", name: "tts_create", status: "RUNNING" },
      ],
    });

    expect(status).toMatchObject({
      totalBlocks: 2,
      readyVisuals: 1,
      hasRunningTasks: true,
      isComplete: false,
    });
    expect(status.blockStatuses).toEqual([
      expect.objectContaining({ blockId: "block-1", visual: "completed", voice: "pending" }),
      expect.objectContaining({ blockId: "block-2", visual: "pending", voice: "pending" }),
    ]);
  });
});

describe("buildCreationAssetsPollIntervalMs", () => {
  it("polls while assets are incomplete and stops after preparation is complete", () => {
    expect(buildCreationAssetsPollIntervalMs({ isComplete: false })).toBe(2500);
    expect(buildCreationAssetsPollIntervalMs({ isComplete: true })).toBeNull();
  });
});

describe("buildStoryboardAssetGroups", () => {
  it("groups visual candidates by storyboard block and separates voiceover from music", () => {
    const groups = buildStoryboardAssetGroups(
      [
        { id: "block-1", order: 1, title: "分镜1", script: "A", visualPrompt: "prompt A", audioPrompt: null },
        { id: "block-2", order: 2, title: "分镜2", script: "B", visualPrompt: "prompt B", audioPrompt: null },
      ],
      [
        { id: "image-1", blockId: "block-1", title: "First image", type: "IMAGE", url: "https://cdn/1.png", metadata: { task: { tool: "image_to_image" } } },
        { id: "image-2", blockId: "block-1", title: "Edited image", type: "IMAGE", url: "https://cdn/1b.png", metadata: { task: { tool: "image_to_image" } } },
        { id: "image-3", blockId: "block-2", title: "Second image", type: "IMAGE", url: "https://cdn/2.png", metadata: { task: { tool: "image_to_image" } } },
        { id: "voice-1", blockId: "block-1", title: "Voice", type: "AUDIO", url: "https://cdn/voice.mp3", metadata: { task: { tool: "tts_create" } } },
        { id: "music-1", blockId: null, title: "BGM", type: "AUDIO", url: "https://cdn/bgm.mp3", metadata: { task: { tool: "text_to_bgm" } } },
      ],
    );

    expect(groups[0]).toMatchObject({
      blockId: "block-1",
      displayAsset: expect.objectContaining({ id: "image-1" }),
      visualAssets: [expect.objectContaining({ id: "image-1" }), expect.objectContaining({ id: "image-2" })],
      voiceAssets: [expect.objectContaining({ id: "voice-1" })],
    });
    expect(groups[1]).toMatchObject({
      blockId: "block-2",
      displayAsset: expect.objectContaining({ id: "image-3" }),
      visualAssets: [expect.objectContaining({ id: "image-3" })],
      voiceAssets: [],
    });
    expect(groups.musicAssets).toEqual([expect.objectContaining({ id: "music-1" })]);
  });

  it("matches unassigned storyboard audio to blocks by shot id before falling back to order", () => {
    const groups = buildStoryboardAssetGroups(
      [
        { id: "block-1", order: 1, title: "分镜1", script: "第一句", visualPrompt: null, audioPrompt: null, metadata: { shotId: "shot-a" } },
        { id: "block-2", order: 2, title: "分镜2", script: "第二句", visualPrompt: null, audioPrompt: null, metadata: { shotId: "shot-b" } },
      ],
      [
        { id: "voice-b", blockId: null, title: "Voice B", type: "AUDIO", url: "https://cdn/b.mp3", metadata: { task: { tool: "tts_create", shotId: "shot-b" } } },
        { id: "voice-a", blockId: null, title: "Voice A", type: "AUDIO", url: "https://cdn/a.mp3", metadata: { task: { tool: "tts_create", shotId: "shot-a" } } },
      ],
    );

    expect(groups[0].voiceAssets[0]?.id).toBe("voice-a");
    expect(groups[1].voiceAssets[0]?.id).toBe("voice-b");
  });

  it("computes the timeline playhead position from playback time", () => {
    expect(getPlayheadPosition({ elapsedSeconds: 2.5, blockCount: 3, secondsPerBlock: 5, blockWidth: 160, blockGap: 4 })).toBe(80);
    expect(getPlayheadPosition({ elapsedSeconds: 7.5, blockCount: 3, secondsPerBlock: 5, blockWidth: 160, blockGap: 4 })).toBe(244);
    expect(getPlayheadPosition({ elapsedSeconds: 20, blockCount: 3, secondsPerBlock: 5, blockWidth: 160, blockGap: 4 })).toBe(488);
  });
});

describe("buildResourcePreloadKey", () => {
  it("stays stable when polling returns the same asset URLs with new object references", () => {
    const first = buildResourcePreloadKey([
      { id: "image-1", blockId: "block-1", title: "Frame", type: "IMAGE", url: "https://cdn.test/frame.png", metadata: { version: 1 } },
      { id: "audio-1", blockId: "block-1", title: "Voice", type: "AUDIO", url: "https://cdn.test/voice.mp3", metadata: { status: "old" } },
    ]);
    const second = buildResourcePreloadKey([
      { id: "audio-1", blockId: "block-1", title: "Voice updated", type: "AUDIO", url: "https://cdn.test/voice.mp3", metadata: { status: "new" } },
      { id: "image-1", blockId: "block-1", title: "Frame updated", type: "IMAGE", url: "https://cdn.test/frame.png", metadata: { version: 2 } },
    ]);

    expect(second).toBe(first);
  });

  it("changes when the actual preloadable URLs change", () => {
    const first = buildResourcePreloadKey([
      { id: "image-1", blockId: "block-1", title: "Frame", type: "IMAGE", url: "https://cdn.test/frame.png", metadata: null },
    ]);
    const second = buildResourcePreloadKey([
      { id: "image-1", blockId: "block-1", title: "Frame", type: "IMAGE", url: "https://cdn.test/frame.png", metadata: null },
      { id: "audio-1", blockId: "block-1", title: "Voice", type: "AUDIO", url: "https://cdn.test/voice.mp3", metadata: null },
    ]);

    expect(second).not.toBe(first);
  });
});

describe("frontend-portal export option parity", () => {
  it("keeps the full frontend-portal style option counts", () => {
    expect(TITLE_STYLES).toHaveLength(7);
    expect(SUBTITLE_STYLES).toHaveLength(9);
    expect(EFFECT_STYLES).toHaveLength(3);
    expect(TRANSITION_STYLES).toHaveLength(16);
    expect(ANIMATION_EFFECTS.title).toHaveLength(5);
    expect(ANIMATION_EFFECTS.subtitle).toHaveLength(4);
  });
});

describe("getPreviewFrameIndex", () => {
  it("maps playback seconds to the active storyboard frame", () => {
    expect(getPreviewFrameIndex({ elapsedSeconds: 0, blockCount: 4, secondsPerBlock: 5 })).toBe(0);
    expect(getPreviewFrameIndex({ elapsedSeconds: 5, blockCount: 4, secondsPerBlock: 5 })).toBe(1);
    expect(getPreviewFrameIndex({ elapsedSeconds: 19.9, blockCount: 4, secondsPerBlock: 5 })).toBe(3);
    expect(getPreviewFrameIndex({ elapsedSeconds: 25, blockCount: 4, secondsPerBlock: 5 })).toBe(3);
  });
});

describe("preview timeline helpers", () => {
  it("shows the preview title only during the opening title window", () => {
    expect(shouldShowPreviewTitle({ elapsedSeconds: 0 })).toBe(true);
    expect(shouldShowPreviewTitle({ elapsedSeconds: 4.04 })).toBe(true);
    expect(shouldShowPreviewTitle({ elapsedSeconds: 4.05 })).toBe(false);
    expect(shouldShowPreviewTitle({ elapsedSeconds: 10 })).toBe(false);
  });

  it("maps clickable timeline positions to playback seconds", () => {
    expect(getTimelineSeekSeconds({ offsetX: 0, timelineWidth: 800, durationSeconds: 20 })).toBe(0);
    expect(getTimelineSeekSeconds({ offsetX: 400, timelineWidth: 800, durationSeconds: 20 })).toBe(10);
    expect(getTimelineSeekSeconds({ offsetX: 900, timelineWidth: 800, durationSeconds: 20 })).toBe(20);
    expect(getTimelineSeekSeconds({ offsetX: -20, timelineWidth: 800, durationSeconds: 20 })).toBe(0);
  });

  it("builds a background music preview track that spans the full preview duration", () => {
    const groups = buildStoryboardAssetGroups(
      [{ id: "block-1", order: 1, title: "分镜1", script: "A", visualPrompt: null, audioPrompt: null }],
      [
        { id: "music-1", blockId: null, title: "BGM", type: "AUDIO", url: "https://cdn/bgm.mp3", metadata: { volume: 0.35, task: { tool: "text_to_bgm" } } },
      ],
    );

    expect(buildPreviewBgmTracks(groups.musicAssets, 20)).toEqual([
      { id: "music-1", title: "BGM", url: "https://cdn/bgm.mp3", startSeconds: 0, durationSeconds: 20, volume: 0.35 },
    ]);
  });

  it("selects the active storyboard voiceover for preview playback", () => {
    const groups = buildStoryboardAssetGroups(
      [
        { id: "block-1", order: 1, title: "分镜1", script: "A", visualPrompt: null, audioPrompt: null },
        { id: "block-2", order: 2, title: "分镜2", script: "B", visualPrompt: null, audioPrompt: null },
      ],
      [
        { id: "voice-1", blockId: "block-1", title: "Voice 1", type: "AUDIO", url: "https://cdn/voice-1.mp3", metadata: { task: { tool: "tts_create" } } },
        { id: "voice-2", blockId: "block-2", title: "Voice 2", type: "AUDIO", url: "https://cdn/voice-2.mp3", metadata: { task: { tool: "tts_create" } } },
      ],
    );

    expect(getPreviewVoiceAsset(groups, 0)?.id).toBe("voice-1");
    expect(getPreviewVoiceAsset(groups, 1)?.id).toBe("voice-2");
    expect(getPreviewVoiceAsset(groups, 5)).toBeUndefined();
  });

  it("uses TTS duration as the storyboard preview duration", () => {
    const groups = buildStoryboardAssetGroups(
      [
        { id: "block-1", order: 1, title: "分镜1", script: "A", visualPrompt: null, audioPrompt: null },
        { id: "block-2", order: 2, title: "分镜2", script: "B", visualPrompt: null, audioPrompt: null },
        { id: "block-3", order: 3, title: "分镜3", script: "C", visualPrompt: null, audioPrompt: null },
      ],
      [
        { id: "voice-1", blockId: "block-1", title: "Voice 1", type: "AUDIO", url: "https://cdn/voice-1.mp3", metadata: { duration: 3.2, task: { tool: "tts_create" } } },
        { id: "voice-2", blockId: "block-2", title: "Voice 2", type: "AUDIO", url: "https://cdn/voice-2.mp3", metadata: { task: { duration: 6, tool: "tts_create" } } },
      ],
    );

    expect(getStoryboardPreviewDurations(groups, 5)).toEqual([3.2, 6, 5]);
    expect(getVariablePreviewFrameIndex({ elapsedSeconds: 3.1, durations: [3.2, 6, 5] })).toBe(0);
    expect(getVariablePreviewFrameIndex({ elapsedSeconds: 3.2, durations: [3.2, 6, 5] })).toBe(1);
    expect(getVariablePreviewFrameIndex({ elapsedSeconds: 9.3, durations: [3.2, 6, 5] })).toBe(2);
  });

  it("uses measured TTS duration for image storyboard preview and export when provider metadata has no duration", () => {
    const measuredAssets = applyAssetDurationMeasurement(
      [
        { id: "image-1", blockId: "block-1", title: "Frame", type: "IMAGE", url: "https://cdn/frame.png", metadata: { task: { tool: "image_to_image" } } },
        { id: "voice-1", blockId: "block-1", title: "Voice", type: "AUDIO", url: "https://cdn/voice.mp3", metadata: { task: { tool: "tts_create" } } },
      ],
      "voice-1",
      2.84,
    );
    const groups = buildStoryboardAssetGroups(
      [{ id: "block-1", order: 1, title: "分镜1", script: "旁白", visualPrompt: null, audioPrompt: null }],
      measuredAssets,
    );

    expect(getStoryboardPreviewDurations(groups, 5)).toEqual([2.84]);
    expect(buildCreationExportPayload({
      threadId: "thread-1",
      title: "Export",
      aspectRatio: "16:9",
      resolution: 720,
      preset: defaultCreationExportPreset,
      blocks: [{ id: "block-1", order: 1, title: "分镜1", script: "旁白", visualPrompt: null, audioPrompt: null }],
      assets: measuredAssets,
    }).items[0]).toMatchObject({
      image: { url: "https://cdn/frame.png" },
      audio: [{ url: "https://cdn/voice.mp3", duration: 2.84 }],
    });
  });

  it("keeps locally measured TTS duration when polling returns stale asset metadata", () => {
    const localAssets = [
      { id: "voice-1", blockId: "block-1", title: "Voice", type: "AUDIO", url: "https://cdn/voice.mp3", metadata: { duration: 2.84, task: { tool: "tts_create" } } },
    ];
    const polledAssets = [
      { id: "voice-1", blockId: "block-1", title: "Voice updated", type: "AUDIO", url: "https://cdn/voice.mp3", metadata: { task: { tool: "tts_create" } } },
    ];

    const merged = mergePolledCreationAssets(localAssets, polledAssets);

    expect(merged[0]).toMatchObject({
      title: "Voice updated",
      metadata: { duration: 2.84, task: { tool: "tts_create" } },
    });
  });

  it("computes playhead position across variable TTS-driven storyboard durations", () => {
    expect(getVariablePlayheadPosition({ elapsedSeconds: 1.6, durations: [3.2, 6], blockWidths: [160, 300], blockGap: 4 })).toBe(80);
    expect(getVariablePlayheadPosition({ elapsedSeconds: 3.2, durations: [3.2, 6], blockWidths: [160, 300], blockGap: 4 })).toBe(164);
    expect(getVariablePlayheadPosition({ elapsedSeconds: 6.2, durations: [3.2, 6], blockWidths: [160, 300], blockGap: 4 })).toBe(314);
  });

  it("keeps image storyboard blocks equal width while playback speed follows TTS duration", () => {
    const blockWidths = getEqualStoryboardTimelineBlockWidths(2, 160);

    expect(blockWidths).toEqual([160, 160]);
    expect(getVariablePlayheadPosition({ elapsedSeconds: 1.6, durations: [3.2, 8], blockWidths, blockGap: 4 })).toBe(80);
    expect(getVariablePlayheadPosition({ elapsedSeconds: 7.2, durations: [3.2, 8], blockWidths, blockGap: 4 })).toBe(244);
    expect(getVariableTimelineSeekSeconds({ offsetX: 244, durations: [3.2, 8], blockWidths, blockGap: 4 })).toBe(7.2);
  });

  it("maps clicks inside variable-width storyboard blocks to their TTS-driven playback time", () => {
    expect(getVariableTimelineSeekSeconds({ offsetX: 80, durations: [3.2, 6], blockWidths: [160, 300], blockGap: 4 })).toBe(1.6);
    expect(getVariableTimelineSeekSeconds({ offsetX: 164, durations: [3.2, 6], blockWidths: [160, 300], blockGap: 4 })).toBe(3.2);
    expect(getVariableTimelineSeekSeconds({ offsetX: 314, durations: [3.2, 6], blockWidths: [160, 300], blockGap: 4 })).toBe(6.2);
  });
});

describe("mapJobToExportState", () => {
  it("keeps completed job preview url available after polling", () => {
    expect(
      mapJobToExportState({
        id: "job-1",
        status: "COMPLETED",
        progress: 100,
        output: { url: "https://cdn/render.mp4" },
        renderOutputs: [{ url: "https://cdn/fallback.mp4" }],
      }),
    ).toMatchObject({
      status: "success",
      progress: 100,
      videoUrl: "https://cdn/render.mp4",
      message: "Export completed",
    });
  });

  it("maps active jobs to exporting progress for header and dialog progress UI", () => {
    expect(
      mapJobToExportState({
        id: "job-1",
        status: "ACTIVE",
        progress: 42,
        output: null,
        renderOutputs: [],
      }),
    ).toMatchObject({
      status: "exporting",
      progress: 42,
      message: "Rendering video",
    });
  });

  it("surfaces queued render jobs as waiting for the render worker", () => {
    expect(
      mapJobToExportState({
        id: "job-1",
        status: "QUEUED",
        progress: 0,
        output: null,
        renderOutputs: [],
        queue: { state: "waiting", position: 1, total: 1 },
      }),
    ).toMatchObject({
      status: "exporting",
      progress: 0,
      message: "Waiting for render worker (queue position 1/1)",
    });
  });
});

describe("formatExportProgressLabel", () => {
  it("formats clamped export progress for the preview dialog", () => {
    expect(formatExportProgressLabel(42.4)).toBe("42%");
    expect(formatExportProgressLabel(101)).toBe("100%");
    expect(formatExportProgressLabel(Number.NaN)).toBe("0%");
  });
});
