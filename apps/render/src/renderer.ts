import path from "node:path";
import { readFile } from "node:fs/promises";
import {
  FFCreator,
  FFScene,
  FFText,
  FFVideo,
  FFImage,
  FFAudio,
} from "ffcreator";
import { cleanupFiles } from "./cleanup.js";
import {
  cacheDir,
  outputDir,
  DEFAULT_SUBTITLE_STYLE,
  DEFAULT_TITLE_STYLE,
  DEFAULT_BGM_VOLUME,
} from "./config.js";
import { registerCustomEffects, applyCameraShake } from "./effects.js";
import type { AssetItem, InputParameter, VideoUser } from "./types.js";
import { putObject } from "./storage.js";
import { resolveTextFontPath } from "./text-fonts.js";
import { resolveSceneDuration, resolveSubtitleSegmentsForScene, type SubtitleTiming } from "./render-timing.js";

type CreatorOptions = {
  onProgress?: (progress: number) => void | Promise<void>;
};

function parseStyle(styleStr: string | undefined): any {
  if (!styleStr) return {};
  try {
    return JSON.parse(styleStr);
  } catch {
    return {};
  }
}

function toFfAudioVolumeFromHtmlPercent(volume: number | undefined) {
  if (volume === undefined) return DEFAULT_BGM_VOLUME;
  if (!Number.isFinite(volume)) return DEFAULT_BGM_VOLUME;
  return Math.max(0, Math.min(1, volume));
}

function summarizeSubtitleSegments(segments: Array<{ text: string; start: number; end: number }>, limit = 8) {
  return {
    count: segments.length,
    firstStartSec: segments[0]?.start,
    lastEndSec: segments.at(-1)?.end,
    sample: segments.slice(0, limit).map((segment) => ({
      text: segment.text,
      startSec: segment.start,
      endSec: segment.end,
      durationSec: Math.round((segment.end - segment.start) * 1000) / 1000,
    })),
  };
}

function isTimingDebugEnabled() {
  return process.env.BATCH_DEBUG_TIMING === "1" || process.env.RENDER_DEBUG_TIMING === "1";
}

export async function createAndRunCreator(
  processedItems: AssetItem[],
  bgAudios: Array<{ path: string; volume?: number }>,
  width: number,
  height: number,
  taskId: string,
  tempFiles: string[],
  inputParameter: InputParameter | undefined,
  title?: { text: string },
  narrationAudio?: { path: string; text?: string; duration?: number; subtitleTimings?: SubtitleTiming[] },
  isFreeUser: boolean = false,
  options: CreatorOptions = {},
) {
  const creator = new FFCreator({
    cacheDir,
    outputDir,
    width,
    height,
    log: false,
    parallel: 8,
  });

  creator.setConf("normalizeAudio", true);
  creator.setConf("fps", 30);

  registerCustomEffects(creator, width, height);

  const advParams = inputParameter?.advancedParameters || {};
  const globalTitleStyle = parseStyle(advParams.titleStyle);
  const globalSubtitleStyle = parseStyle(advParams.subtitleStyle);
  const globalVideoEffectStyle = parseStyle(advParams.videoEffectStyle);
  const globalTransitionStyle = parseStyle(advParams.transitionStyle);

  const isGenerateTransition = advParams.isGenerateTransition || "yes";
  const isGenerateVideoEffect = advParams.isGenerateVideoEffect || "yes";
  const isGenerateTitle = advParams.isGenerateTitle || "yes";
  const isGenerateSubtitle = advParams.isGenerateSubtitle || "yes";
  const isGenerateTitleAnimation = advParams.isGenerateTitleAnimation || "yes";
  const isGenerateSubtitleAnimation =
    advParams.isGenerateSubtitleAnimation || "yes";
  const titleAnimation = advParams.titleAnimation;
  const subtitleAnimation =
    advParams.subtitleAnimation === "auto"
      ? undefined
      : advParams.subtitleAnimation;

  if (bgAudios.length > 0) {
    const firstBgAudio = bgAudios[0];
    const volume = toFfAudioVolumeFromHtmlPercent(firstBgAudio.volume);
    const bgAudio = new FFAudio({
      path: firstBgAudio.path,
      volume,
      loop: true,
    });
    creator.addAudio(bgAudio);
  }

  if (narrationAudio?.path) {
    creator.addAudio(
      new FFAudio({
        path: narrationAudio.path,
        volume: 1.0,
      }),
    );
    if (isTimingDebugEnabled()) {
      console.log(
        `[render:${taskId}] Global narration added ${JSON.stringify({
          durationSec: narrationAudio.duration,
          textChars: narrationAudio.text?.length ?? 0,
          subtitleTimingCount: narrationAudio.subtitleTimings?.length ?? 0,
          subtitleLastEndMs: narrationAudio.subtitleTimings?.at(-1)?.end,
        })}`,
      );
    }
  }

  const titleGlobalStart = 0;
  const titleGlobalEnd = 4;
  const titleEps = 1e-6;
  let timelineCursor = 0;

  processedItems.forEach((item, index) => {
    const scene = new FFScene();

    const baseDuration = resolveSceneDuration(item, narrationAudio?.duration, processedItems.length);
    let duration = baseDuration;

    const transitionName = globalTransitionStyle?.name;
    const transitionDuration = globalTransitionStyle?.duration || 1.0;

    const hasTransition =
      index < processedItems.length - 1 &&
      isGenerateTransition === "yes" &&
      transitionName;

    if (hasTransition) {
      duration += transitionDuration;
    }

    const sceneGlobalStart = timelineCursor;
    const sceneGlobalEnd = timelineCursor + duration;
    timelineCursor = sceneGlobalEnd;
    if (isTimingDebugEnabled()) {
      console.log(
        `[render:${taskId}] Scene timing ${JSON.stringify({
          sceneIndex: index,
          baseDurationSec: baseDuration,
          finalDurationSec: duration,
          sceneGlobalStartSec: sceneGlobalStart,
          sceneGlobalEndSec: sceneGlobalEnd,
          hasTransition: Boolean(hasTransition),
          transitionName: hasTransition ? transitionName : null,
          transitionDurationSec: hasTransition ? transitionDuration : 0,
          videoPayloadDurationSec: item.video?.duration,
          probedVideoDurationSec: item.probedVideoDuration,
          hasSceneAudio: Boolean(item.audioPath),
          fallbackSubtitlePreview: item.sub_title?.text?.slice(0, 120) ?? "",
        })}`,
      );
    }

    scene.setDuration(duration);

    addVisualNode(
      scene,
      item,
      width,
      height,
      duration,
      globalVideoEffectStyle,
      isGenerateVideoEffect,
    );

    addAudio(scene, item);

    if (isGenerateSubtitle !== "no") {
      addSubtitle(
        scene,
        item,
        width,
        height,
        duration,
        globalSubtitleStyle,
        isGenerateSubtitleAnimation,
        subtitleAnimation,
        narrationAudio?.subtitleTimings,
        sceneGlobalStart,
        taskId,
        index,
      );
    }

    if (isGenerateTitle !== "no" && title?.text) {
      const overlapStart = Math.max(sceneGlobalStart, titleGlobalStart);
      const overlapEnd = Math.min(sceneGlobalEnd, titleGlobalEnd);
      if (overlapEnd - overlapStart > titleEps) {
        const localStart = overlapStart - sceneGlobalStart;
        const localEnd = overlapEnd - sceneGlobalStart;
        const isFirstSegment =
          Math.abs(overlapStart - titleGlobalStart) <= titleEps;
        const isLastSegment =
          Math.abs(overlapEnd - titleGlobalEnd) <= titleEps;
        addTitle(
          scene,
          title,
          width,
          height,
          {
            start: localStart,
            end: localEnd,
            isFirstSegment,
            isLastSegment,
          },
          globalTitleStyle,
          isGenerateTitleAnimation,
          titleAnimation,
        );
      }
    }

    if (isFreeUser) {
      addWatermark(scene, width, height);
    }

    setTransition(
      scene,
      transitionName,
      Boolean(hasTransition),
      transitionDuration,
    );

    creator.addChild(scene);
  });

  return await new Promise<{
    objectKey: string;
    url: string;
    fileName: string;
  }>((resolve, reject) => {
    creator.on("complete", async (e: any) => {
      try {
        const data = await readFile(e.output);
        const objectKey = `renders/${taskId}.mp4`;
        const upload = await putObject({
          objectKey,
          body: data,
          contentType: "video/mp4",
        });
        const result = {
          objectKey,
          url: upload.publicUrl,
          fileName: `${taskId}.mp4`,
        };

        try {
          creator.destroy();
        } catch {}
        await cleanupFiles(tempFiles, [e.output]);
        resolve(result);
      } catch (uploadErr) {
        try {
          creator.destroy();
        } catch {}
        await cleanupFiles(tempFiles);
        reject(uploadErr);
      }
    });

    creator.on("error", async (e: any) => {
      try {
        if (typeof creator.destroy === "function") {
          creator.destroy();
        }
      } catch {}
      await cleanupFiles(tempFiles);
      reject(e);
    });

    creator.on("progress", (e: any) => {
      const rawProgress = Number(e?.percent ?? e?.progress ?? 0);
      const progress = rawProgress <= 1 ? rawProgress * 100 : rawProgress;
      void Promise.resolve(options.onProgress?.(progress)).catch((error) => {
        console.warn("[render] failed to persist render progress", error);
      });
    });

    creator.start();
  });
}

function applyResolvedTextFont(textNode: any, style: any) {
  if (typeof textNode.setFont !== "function") return;
  textNode.setFont(resolveTextFontPath(style));
}

function addVisualNode(
  scene: FFScene,
  item: AssetItem,
  width: number,
  height: number,
  duration: number,
  videoEffectStyle: any,
  isGenerateVideoEffect: string,
) {
  let visualNode: any = null;

  const commonProps = {
    x: width / 2,
    y: height / 2,
    width,
    height,
  };

  if (item.videoPath) {
    visualNode = new FFVideo({
      path: item.videoPath,
      ...commonProps,
    });
  } else if (item.imagePath) {
    visualNode = new FFImage({
      path: item.imagePath,
      ...commonProps,
    });
  }

  if (visualNode) {
    if (isGenerateVideoEffect === "yes") {
      const effectValue = videoEffectStyle?.name;
      const effectName = ["mini_zoom", "ken_burns", "camera_shake"].includes(
        effectValue,
      )
        ? effectValue
        : "ken_burns";

      if (effectValue) {
        if (effectName === "camera_shake") {
          applyCameraShake(visualNode, duration);
        } else {
          visualNode.addEffect(effectName, duration, 0);
        }
      }
    }

    scene.addChild(visualNode);
  } else {
    scene.setBgColor("#101012");
  }
}

function addAudio(scene: FFScene, item: AssetItem) {
  if (item.audioPath) {
    scene.addAudio({
      path: item.audioPath,
      volume: 1.0,
    });
  }
}

function resolveSubtitleEntranceEffect(animationName: string) {
  const noAlphaEntranceEffects = new Set([
    "slideInDown",
    "slideInLeft",
    "slideInRight",
    "slideInUp",
  ]);

  if (noAlphaEntranceEffects.has(animationName)) {
    return ["fadeIn", animationName];
  }

  return animationName;
}

function addSubtitle(
  scene: FFScene,
  item: AssetItem,
  width: number,
  height: number,
  sceneDuration: number,
  globalStyle: any,
  isGenerateAnimation: string = "yes",
  animationName: string = "fadeIn",
  globalSubtitleTimings?: SubtitleTiming[],
  sceneGlobalStart: number = 0,
  taskId: string = "unknown",
  sceneIndex: number = 0,
) {
  const subtitleData = item.sub_title;

  const mergedStyle = {
    ...DEFAULT_SUBTITLE_STYLE,
    ...globalStyle,
    wordWrap: true,
    wordWrapWidth: width * 0.8,
    breakWords: true,
  };

  const textStyle: any = mergedStyle;

  const maxDimension = Math.max(width, height);
  const scaleFactor = maxDimension / 1920;

  if (!textStyle.fontSize) textStyle.fontSize = 50;
  textStyle.fontSize = Math.round(textStyle.fontSize * scaleFactor);

  const timedSegments: Array<{ text: string; start: number; end: number }> = [];
  const globalTimedSegments = resolveSubtitleSegmentsForScene(
    globalSubtitleTimings,
    sceneGlobalStart,
    sceneDuration,
  );

  timedSegments.push(...globalTimedSegments);
  if (globalSubtitleTimings?.length && isTimingDebugEnabled()) {
    console.log(
      `[render:${taskId}] Subtitle timing ${JSON.stringify({
        sceneIndex,
        source: "global-edge-tts-json",
        sceneGlobalStartSec: sceneGlobalStart,
        sceneDurationSec: sceneDuration,
        globalTimingCount: globalSubtitleTimings.length,
        globalFirstStartMs: globalSubtitleTimings[0]?.start,
        globalLastEndMs: globalSubtitleTimings.at(-1)?.end,
        localSegments: summarizeSubtitleSegments(timedSegments),
      })}`,
    );
  }

  if (timedSegments.length === 0 && item.audio && item.audio.length > 0) {
    const speed = item.audioSpeed && item.audioSpeed > 0 ? item.audioSpeed : 1;
    const audioDurations =
      item.audioDurations?.length === item.audio.length
        ? item.audioDurations
        : item.audio.map((a) => a.duration ?? 0);

    let offset = 0;
    for (let audioIndex = 0; audioIndex < item.audio.length; audioIndex++) {
      const audio = item.audio[audioIndex];
      const text = audio.text;
      const durationCandidate =
        audioDurations[audioIndex] ?? audio.duration ?? 0;

      const rawStart = offset;
      const rawEnd = offset + durationCandidate;
      const start = rawStart / speed;
      const end = rawEnd / speed;

      const clampedStart = Math.max(0, Math.min(sceneDuration, start));
      const clampedEnd = Math.max(0, Math.min(sceneDuration, end));

      if (text && clampedEnd > clampedStart) {
        timedSegments.push({
          text,
          start: clampedStart,
          end: clampedEnd,
        });
      }

      offset += durationCandidate;
    }
    if (timedSegments.length > 0 && isTimingDebugEnabled()) {
      console.log(
        `[render:${taskId}] Subtitle timing ${JSON.stringify({
          sceneIndex,
          source: "per-scene-audio",
          sceneGlobalStartSec: sceneGlobalStart,
          sceneDurationSec: sceneDuration,
          localSegments: summarizeSubtitleSegments(timedSegments),
        })}`,
      );
    }
  }

  const targetY = height * 0.8;

  if (timedSegments.length > 0) {
    for (const seg of timedSegments) {
      const subtitle = new FFText({
        text: seg.text,
        x: width / 2,
        y: targetY,
        fontSize: textStyle.fontSize,
      });

      subtitle.setStyle(textStyle);
      applyResolvedTextFont(subtitle, textStyle);
      if (textStyle.color) subtitle.setColor(textStyle.color);
      if (textStyle.backgroundColor)
        subtitle.setBackgroundColor(textStyle.backgroundColor);
      subtitle.alignCenter();

      subtitle.setOpacity(0);

      if (isGenerateAnimation === "yes" && animationName) {
        const effectDuration = Math.min(
          0.6,
          Math.max(0.2, seg.end - seg.start),
        );
        const entranceEffect = resolveSubtitleEntranceEffect(animationName);
        if (Array.isArray(entranceEffect)) {
          subtitle.addEffect(entranceEffect, effectDuration, seg.start);
        } else {
          subtitle.addEffect(entranceEffect, effectDuration, seg.start);
        }
      } else {
        const showDuration = Math.max(0, seg.end - seg.start);
        const fadeInDuration = Math.min(0.2, Math.max(0.05, showDuration / 2));
        subtitle.addEffect("fadeIn", fadeInDuration, seg.start);
      }

      const showDuration = Math.max(0, seg.end - seg.start);
      const fadeOutDuration = Math.min(0.2, Math.max(0.05, showDuration / 2));
      const fadeOutDelay = Math.max(seg.start, seg.end - fadeOutDuration);
      subtitle.addEffect("fadeOut", fadeOutDuration, fadeOutDelay);

      scene.addChild(subtitle);
    }
    return;
  }

  if (globalSubtitleTimings?.length) return;

  if (subtitleData && subtitleData.text) {
    const subtitle = new FFText({
      text: subtitleData.text,
      x: width / 2,
      y: targetY,
      fontSize: textStyle.fontSize,
    });

    subtitle.setStyle(textStyle);
    applyResolvedTextFont(subtitle, textStyle);
    if (textStyle.color) subtitle.setColor(textStyle.color);
    if (textStyle.backgroundColor)
      subtitle.setBackgroundColor(textStyle.backgroundColor);
    subtitle.alignCenter();

    if (isGenerateAnimation === "yes" && animationName) {
      subtitle.addEffect(animationName, 1, 0);
    }

    scene.addChild(subtitle);
  }
}

function addTitle(
  scene: FFScene,
  title: { text: string } | undefined,
  width: number,
  height: number,
  timing: {
    start: number;
    end: number;
    isFirstSegment: boolean;
    isLastSegment: boolean;
  },
  globalStyle: any,
  isGenerateAnimation: string = "yes",
  animationName: string = "backInDown",
) {
  if (!title?.text) return;

  const { start, end, isFirstSegment, isLastSegment } = timing;
  const segDuration = Math.max(0, end - start);
  if (segDuration <= 0) return;

  const titleStyle: any = {
    ...DEFAULT_TITLE_STYLE,
    ...globalStyle,
    wordWrap: true,
    wordWrapWidth: width * 0.8,
    breakWords: true,
  };

  const maxDimension = Math.max(width, height);
  const scaleFactor = maxDimension / 1920;

  if (!titleStyle.fontSize) titleStyle.fontSize = 80;
  titleStyle.fontSize = Math.round(titleStyle.fontSize * scaleFactor);

  const titleText = new FFText({
    text: title.text,
    x: width / 2,
    y: height * 0.2,
    fontSize: titleStyle.fontSize,
  });

  if (titleStyle.color) titleText.setColor(titleStyle.color);
  titleText.alignCenter();
  titleText.setAnchor(0.5, 0);
  titleText.setStyle(titleStyle);
  applyResolvedTextFont(titleText, titleStyle);
  titleText.setOpacity(0);

  if (isFirstSegment && isGenerateAnimation === "yes" && animationName) {
    const inDuration = Math.min(1.0, Math.max(0.2, segDuration));
    titleText.addEffect(animationName, inDuration, start);
  } else {
    const inDuration = Math.min(0.08, Math.max(0.01, segDuration / 10));
    titleText.addEffect("fadeIn", inDuration, start);
  }

  if (isLastSegment) {
    const outDuration = Math.min(0.3, Math.max(0.08, segDuration / 4));
    const outDelay = Math.max(start, end - outDuration);
    titleText.addEffect("fadeOut", outDuration, outDelay);
  }

  scene.addChild(titleText);
}

function addWatermark(scene: FFScene, width: number, height: number) {
  const minSide = Math.max(1, Math.min(width, height));
  const margin = Math.max(20, Math.round(minSide * 0.04));
  const wmWidth = Math.round(minSide * 0.25);

  const watermarkText = new FFText({
    text: "OpenDirector",
    x: margin,
    y: margin,
    fontSize: Math.round(wmWidth * 0.3),
    color: "#ffffff",
  });

  applyResolvedTextFont(watermarkText, { fontFamily: "Noto Sans", fontWeight: 700 });
  watermarkText.setAnchor(0, 0);
  watermarkText.setOpacity(0.5);
  scene.addChild(watermarkText);
}

function setTransition(
  scene: FFScene,
  transitionStyle: string | undefined,
  hasTransition: boolean,
  transitionDuration: number,
) {
  if (hasTransition) {
    scene.setTransition(transitionStyle!, transitionDuration);
  }
}
