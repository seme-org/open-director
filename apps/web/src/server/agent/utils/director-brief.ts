import {
  artStylePromptLines,
  loadPublicArtStyles,
  resolveArtStyleFromCatalog,
  type PublicArtStyle,
} from "@/server/agent/art-styles";
import { voicePromptLines } from "@/server/agent/voices";
import type { DirectorBriefDraft } from "@/server/agent/schemas/director-brief";
import type { DirectorIntent } from "@/server/agent/schemas/recipe";

const supportedRecipeLanguages = [
  { value: "zh-CN", label: "中文" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "pt", label: "Português" },
  { value: "it", label: "Italiano" },
  { value: "ru", label: "Русский" },
  { value: "ar", label: "العربية" },
  { value: "hi", label: "हिन्दी" },
];

function defaultLanguageForPrompt(prompt: string) {
  const lowerPrompt = prompt.toLowerCase();
  const explicitLanguage = supportedRecipeLanguages.find(
    (language) =>
      lowerPrompt.includes(`language: ${language.value.toLowerCase()}`) ||
      lowerPrompt.includes(`language: ${language.label.toLowerCase()}`) ||
      prompt.includes(`Language: ${language.label}`),
  );
  if (explicitLanguage) return explicitLanguage.value;
  if (/[\u4e00-\u9fa5]/.test(prompt)) return "zh-CN";
  if (/[\u3040-\u30ff]/.test(prompt)) return "ja";
  if (/[\uac00-\ud7af]/.test(prompt)) return "ko";
  if (/[\u0600-\u06ff]/.test(prompt)) return "ar";
  if (/[\u0900-\u097f]/.test(prompt)) return "hi";
  if (/[\u0400-\u04ff]/.test(prompt)) return "ru";
  return "en";
}

function choiceOptions(values: string[], selected: string) {
  return values.map((value) => ({
    value,
    label: value,
    default: value === selected ? 1 : 0,
  }));
}

function durationChoiceOptions(selected: string) {
  return [
    { value: "15s", label: "15 seconds" },
    { value: "30s", label: "30 seconds" },
    { value: "45s", label: "45 seconds" },
    { value: "60s", label: "60 seconds" },
    { value: "90s", label: "90 seconds" },
  ].map((duration) => ({
    ...duration,
    default: duration.value === selected ? 1 : 0,
  }));
}

function languageChoiceOptions(selected: string) {
  return supportedRecipeLanguages.map((language) => ({
    ...language,
    default: language.value === selected ? 1 : 0,
  }));
}

function prefillAudience(prompt: string) {
  if (/(儿童|孩子|小朋友|亲子|寓言|童话|小马过河)/.test(prompt))
    return "亲子家庭、儿童与寓言故事观众";
  if (
    /(creator|influencer|shorts|reels|tiktok|博主|创作者|短视频|自媒体)/i.test(
      prompt,
    )
  )
    return "短视频观众、创作者粉丝与社交平台用户";
  return /[\u4e00-\u9fa5]/.test(prompt)
    ? "泛内容观众与目标用户"
    : "General online audience and target users";
}

function prefillMustInclude(prompt: string) {
  const cleaned = prompt
    .trim()
    .replace(
      /^(我想|我要|请|帮我|帮忙|想要|希望|please|create|make|build|generate)\s*/i,
      "",
    )
    .replace(/^(做|制作|创作|生成|一个|一支|一条|the|a|an)\s*/i, "")
    .replace(/(的故事|故事|的视频|视频|短片|短视频|video|story)$/i, "")
    .trim();
  return cleaned || prompt.slice(0, 60);
}

export function buildDirectorBrief(
  prompt: string,
  artStyleCatalog: PublicArtStyle[] = [],
  draft?: DirectorBriefDraft,
) {
  const language = draft?.language ?? defaultLanguageForPrompt(prompt);
  const selectedArtStyle = artStyleCatalog.length
    ? resolveArtStyleFromCatalog(artStyleCatalog, draft?.art_style).name
    : draft?.art_style;
  const artStyleOptions = artStyleCatalog.map((style, index) => ({
    value: style.name,
    label: style.name,
    default: style.name === selectedArtStyle ? 1 : 0,
    imageUrl: style.imageUrl || undefined,
  }));

  return {
    name: "director_brief",
    title: "Director Brief",
    project_name: draft?.project_name || prompt.slice(0, 60) || "New project",
    intent: draft?.intent ?? ("story" as DirectorIntent),
    exam: {
      input_parameter: [],
      fill_blank: [
        {
          key: "audience",
          label: "Audience",
          value: draft?.audience ?? prefillAudience(prompt),
        },
        {
          key: "must_include",
          label: "Must include",
          value: draft?.must_include ?? prefillMustInclude(prompt),
        },
      ],
      single_choice: [
        {
          key: "language",
          label: "Language",
          options: languageChoiceOptions(language),
        },
        {
          key: "aspect_ratio",
          label: "Aspect Ratio",
          options: choiceOptions(
            ["16:9", "9:16", "1:1"],
            draft?.aspect_ratio ?? "9:16",
          ),
        },
        ...(artStyleOptions.length
          ? [
              {
                key: "art_style",
                label: "Art Style",
                options: artStyleOptions,
              },
            ]
          : []),
        {
          key: "duration",
          label: "Video Duration",
          options: durationChoiceOptions(draft?.duration ?? ""),
        },
      ],
      multi_choice: [],
    },
  };
}
