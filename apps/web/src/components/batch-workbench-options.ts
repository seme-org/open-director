import { ANIMATION_EFFECTS, SUBTITLE_STYLES, TRANSITION_STYLES } from "@/const/styleValue";

export const BATCH_TRANSITION_OPTIONS = [
  { label: "No transition", value: "none", style: undefined, url: undefined },
  ...TRANSITION_STYLES.map((style) => ({
    label: style.label.replace("transition.", "").replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase()),
    value: style.value,
    style: style.value,
    url: style.url,
  })),
] as const;

export const BATCH_SUBTITLE_STYLE_OPTIONS = [
  { label: "No subtitles", value: "none", style: undefined },
  ...SUBTITLE_STYLES.map((style, index) => ({
    label: style.description || `Subtitle style ${index + 1}`,
    value: style.value,
    style: style.value,
  })),
] as const;

export const BATCH_SUBTITLE_ANIMATION_OPTIONS = [
  { label: "No animation", value: "none", name: undefined },
  ...ANIMATION_EFFECTS.subtitle.map((animation) => ({
    label: animation.desc.split(".").at(-1) || animation.name,
    value: animation.name,
    name: animation.name,
  })),
] as const;

export const BATCH_EDGE_TTS_VOICES = [
  { label: "zh-CN-XiaoxiaoNeural - Female", value: "zh-CN-XiaoxiaoNeural" },
  { label: "zh-CN-XiaoyiNeural - Female", value: "zh-CN-XiaoyiNeural" },
  { label: "zh-CN-YunjianNeural - Male", value: "zh-CN-YunjianNeural" },
  { label: "zh-CN-YunxiNeural - Male", value: "zh-CN-YunxiNeural" },
  { label: "zh-CN-YunxiaNeural - Male", value: "zh-CN-YunxiaNeural" },
  { label: "zh-CN-YunyangNeural - Male", value: "zh-CN-YunyangNeural" },
  { label: "en-US-JennyNeural - Female", value: "en-US-JennyNeural" },
  { label: "en-US-GuyNeural - Male", value: "en-US-GuyNeural" },
  { label: "en-US-AriaNeural - Female", value: "en-US-AriaNeural" },
  { label: "en-GB-SoniaNeural - Female", value: "en-GB-SoniaNeural" },
  { label: "ja-JP-NanamiNeural - Female", value: "ja-JP-NanamiNeural" },
  { label: "ja-JP-KeitaNeural - Male", value: "ja-JP-KeitaNeural" },
  { label: "ko-KR-SunHiNeural - Female", value: "ko-KR-SunHiNeural" },
  { label: "ko-KR-InJoonNeural - Male", value: "ko-KR-InJoonNeural" },
] as const;
