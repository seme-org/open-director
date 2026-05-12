import { z } from "zod";

const videoSettingsSchema = z.object({
  aspectRatio: z.enum(["9:16", "16:9", "1:1"]),
  resolution: z.union([z.literal(480), z.literal(720), z.literal(1080)]),
  outputsPerItem: z.number().int().min(1).max(5).catch(5),
  clipDuration: z.number().int().min(2).max(10),
  concatMode: z.enum(["random", "sequential"]),
  transition: z.object({
    enabled: z.boolean(),
    style: z.string().optional(),
  }),
});

const materialsSettingsSchema = z.object({
  source: z.enum(["local", "pexels", "pixabay"]).catch("pexels"),
  localDirectory: z.string(),
  uploadedUrls: z.array(z.string()).catch([]),
  searchMode: z.enum(["subject", "keywords", "script"]).catch("keywords"),
});

const ttsSettingsSchema = z.object({
  provider: z.enum(["edge", "uploaded", "paid"]),
  server: z.enum(["edge", "azure-tts-v1", "azure-tts-v2", "siliconflow", "gemini-tts"]).catch("edge"),
  voice: z.string(),
  rate: z.number().min(0.5).max(2),
  volume: z.number().min(0).max(5),
});

const bgmSettingsSchema = z.object({
  source: z.enum(["random", "custom", "uploaded", "none"]).catch("random"),
  directory: z.string(),
  file: z.string(),
  volume: z.number().min(0).max(1),
});

const subtitleSettingsSchema = z.object({
  enabled: z.boolean(),
  position: z.enum(["top", "center", "bottom", "custom"]),
  customPosition: z.number().min(0).max(100),
  fontName: z.string(),
  fontSize: z.number().int().min(24).max(96),
  color: z.string(),
  backgroundColor: z.union([z.boolean(), z.string()]),
  strokeColor: z.string(),
  strokeWidth: z.number().min(0).max(8),
  style: z.string().optional(),
  animationEnabled: z.boolean().catch(true),
  animationName: z.string().optional(),
});

const scriptSettingsSchema = z.object({
  language: z.string(),
  audience: z.string(),
});

const mediaGenerationSettingsSchema = z.object({
  aiImages: z.boolean(),
  aiVideos: z.boolean(),
});

export const defaultBatchSettings = {
  video: {
    aspectRatio: "9:16",
    resolution: 720,
    outputsPerItem: 1,
    clipDuration: 3,
    concatMode: "random",
    transition: {
      enabled: false,
      style: undefined,
    },
  },
  materials: {
    source: "pexels",
    localDirectory: "assets/materials",
    uploadedUrls: [] as string[],
    searchMode: "keywords",
  },
  tts: {
    provider: "edge",
    server: "edge",
    voice: "zh-CN-XiaoxiaoNeural",
    rate: 1,
    volume: 1,
  },
  bgm: {
    source: "random",
    directory: "assets/bgm/default",
    file: "",
    volume: 0.2,
  },
  subtitle: {
    enabled: true,
    position: "bottom",
    customPosition: 70,
    fontName: "MicrosoftYaHeiBold.ttc",
    fontSize: 52,
    color: "#FFFFFF",
    backgroundColor: true,
    strokeColor: "#000000",
    strokeWidth: 2,
    style: undefined,
    animationEnabled: true,
    animationName: "fadeInUp",
  },
  script: {
    language: "zh-CN",
    audience: "general short-video audience",
  },
  mediaGeneration: {
    aiImages: false,
    aiVideos: false,
  },
} as const;

export const batchSettingsSchema = z.object({
  video: videoSettingsSchema,
  materials: materialsSettingsSchema,
  tts: ttsSettingsSchema,
  bgm: bgmSettingsSchema,
  subtitle: subtitleSettingsSchema,
  script: scriptSettingsSchema,
  mediaGeneration: mediaGenerationSettingsSchema,
});

export type BatchSettings = z.infer<typeof batchSettingsSchema>;

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function normalizeBatchSettings(input: unknown): BatchSettings {
  const value = objectValue(input);
  const video = objectValue(value.video);
  const subtitle = objectValue(value.subtitle);
  return batchSettingsSchema.parse({
    video: {
      ...defaultBatchSettings.video,
      ...video,
      transition: { ...defaultBatchSettings.video.transition, ...objectValue(video.transition) },
    },
    materials: { ...defaultBatchSettings.materials, ...objectValue(value.materials) },
    tts: { ...defaultBatchSettings.tts, ...objectValue(value.tts) },
    bgm: { ...defaultBatchSettings.bgm, ...objectValue(value.bgm) },
    subtitle: { ...defaultBatchSettings.subtitle, ...subtitle },
    script: { ...defaultBatchSettings.script, ...objectValue(value.script) },
    mediaGeneration: { ...defaultBatchSettings.mediaGeneration, ...objectValue(value.mediaGeneration) },
  });
}
