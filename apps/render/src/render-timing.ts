import type { AssetItem } from "./types.js";

export function resolveSceneDuration(item: AssetItem, narrationDuration = 0, sceneCount = 0) {
  if (item.video?.duration) return item.video.duration;
  if (item.videoPath && item.probedVideoDuration) return item.probedVideoDuration;
  if (item.imagePath && item.probedAudioDuration) return item.probedAudioDuration;
  if (narrationDuration > 0 && sceneCount > 0) return narrationDuration / sceneCount;

  const audioDurationFromPayload =
    item.audio?.reduce((sum, audio) => sum + (audio.duration ?? 0), 0) ?? 0;
  return item.video?.duration || audioDurationFromPayload || 5;
}

export type SubtitleTiming = {
  text: string;
  start: number;
  end: number;
};

const subtitlePhraseMaxChars = 16;
const subtitlePhraseMaxDurationSec = 2.4;
const subtitleStrongBreakPattern = /[。！？!?；;]$/;
const subtitleSoftBreakPattern = /[，,、]$/;

function visibleLength(text: string) {
  return Array.from(text.replace(/\s+/g, "")).length;
}

function isSubtitleBreak(text: string) {
  return subtitleStrongBreakPattern.test(text) || subtitleSoftBreakPattern.test(text);
}

function roundSeconds(value: number) {
  return Math.round(value * 1000) / 1000;
}

function pushSubtitlePhrase(
  phrases: Array<{ text: string; start: number; end: number }>,
  phrase: Array<{ text: string; start: number; end: number }>,
) {
  if (!phrase.length) return;
  phrases.push({
    text: phrase.map((entry) => entry.text).join(""),
    start: roundSeconds(phrase[0].start),
    end: roundSeconds(phrase.at(-1)!.end),
  });
}

function groupSubtitlePhraseSegments(segments: Array<{ text: string; start: number; end: number }>) {
  const phrases: Array<{ text: string; start: number; end: number }> = [];
  let phrase: Array<{ text: string; start: number; end: number }> = [];

  for (const segment of segments) {
    const candidateText = `${phrase.map((entry) => entry.text).join("")}${segment.text}`;
    const candidateDuration = phrase.length ? segment.end - phrase[0].start : segment.end - segment.start;
    const wouldBeTooLong =
      phrase.length > 0 &&
      (visibleLength(candidateText) > subtitlePhraseMaxChars || candidateDuration > subtitlePhraseMaxDurationSec);

    if (wouldBeTooLong) {
      pushSubtitlePhrase(phrases, phrase);
      phrase = [];
    }

    phrase.push(segment);

    if (isSubtitleBreak(segment.text)) {
      pushSubtitlePhrase(phrases, phrase);
      phrase = [];
    }
  }

  pushSubtitlePhrase(phrases, phrase);
  return phrases;
}

export function resolveSubtitleSegmentsForScene(
  timings: SubtitleTiming[] | undefined,
  sceneGlobalStart: number,
  sceneDuration: number,
) {
  if (!timings?.length || sceneDuration <= 0) return [];

  const sceneGlobalEnd = sceneGlobalStart + sceneDuration;
  const clippedSegments = timings.flatMap((timing) => {
    const text = timing.text.trim();
    const globalStart = timing.start / 1000;
    const globalEnd = timing.end / 1000;
    const overlapStart = Math.max(sceneGlobalStart, globalStart);
    const overlapEnd = Math.min(sceneGlobalEnd, globalEnd);

    if (!text || overlapEnd <= overlapStart || globalStart < sceneGlobalStart) return [];

    return [
      {
        text,
        start: Math.round((overlapStart - sceneGlobalStart) * 1000) / 1000,
        end: Math.round((overlapEnd - sceneGlobalStart) * 1000) / 1000,
      },
    ];
  });

  return groupSubtitlePhraseSegments(clippedSegments);
}
