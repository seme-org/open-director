import { z } from "zod";

export const directorBriefDraftSchema = z.object({
  project_name: z.string(),
  intent: z.literal(["story"]),
  audience: z.string(),
  must_include: z.string(),
  language: z.enum(["zh-CN", "en", "ja", "ko", "es", "fr", "de", "pt", "it", "ru", "ar", "hi"]),
  aspect_ratio: z.enum(["16:9", "9:16", "1:1"]),
  art_style: z.string(),
  duration: z.enum(["15s", "30s", "45s", "60s", "90s"]),
});

export type DirectorBriefDraft = z.infer<typeof directorBriefDraftSchema>;
