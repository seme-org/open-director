import { z } from "zod";

// --- Script Agent ---
export const scriptOutputSchema = z.object({
  title: z.string(),
  summary: z.string(),
  fullStory: z.string(),
  highlights: z.array(z.object({
    title: z.string(),
    body: z.string(),
  })).max(3),
  agentBriefs: z.object({
    script_agent: z.string(),
    art_style_agent: z.string(),
    storyboard_agent: z.string(),
    character_agent: z.string(),
    location_agent: z.string(),
    voice_agent: z.string(),
    media_agent: z.string(),
  }),
  audience: z.string(),
  tone: z.string(),
  language: z.string(),
});

export type ScriptOutput = z.infer<typeof scriptOutputSchema>;

// --- Art Style Agent ---
export const artStyleOutputSchema = z.object({
  artStyle: z.object({
    name: z.string(),
    promptPrefix: z.string(),
    description: z.string(),
    keywords: z.array(z.string()),
    imageUrl: z.string().nullable(),
    reasoning: z.string().nullable(),
    detail: z.string().nullable(),
    imagePrompt: z.string().nullable(),
  }),
});

export type ArtStyleOutput = z.infer<typeof artStyleOutputSchema>;

// --- Storyboard Agent ---
const shotSchema = z.object({
  shotId: z.string(),
  title: z.string(),
  description: z.string(),
  characters: z.array(z.string()),
  visualElements: z.string(),
  dialogue: z.array(z.object({ speaker: z.string(), text: z.string() })),
});

export const storyboardOutputSchema = z.object({
  scenes: z.array(z.object({
    title: z.string(),
    desc: z.string().nullable(),
    script: z.string(),
    visualPrompt: z.string(),
    audioPrompt: z.string(),
    duration: z.number().min(2).max(30),
    shots: z.array(shotSchema),
  })).min(3).max(8),
});

export type StoryboardOutput = z.infer<typeof storyboardOutputSchema>;

// --- Character Agent ---
export const characterOutputSchema = z.object({
  characters: z.array(z.object({
    name: z.string(),
    description: z.string(),
    promptText: z.string(),
    type: z.enum(["character", "object"]),
    gender: z.enum(["male", "female", "unknown"]),
    voiceId: z.string().nullable(),
    voice: z.string().nullable(),
    imageUrl: z.string().nullable(),
  })),
});

export type CharacterOutput = z.infer<typeof characterOutputSchema>;

// --- Location Agent ---
export const locationOutputSchema = z.object({
  locations: z.array(z.object({
    name: z.string(),
    description: z.string(),
    promptText: z.string(),
    type: z.string(),
    imageUrl: z.string().nullable(),
  })),
});

export type LocationOutput = z.infer<typeof locationOutputSchema>;

// --- Voice Agent ---
export const voiceOutputSchema = z.object({
  voiceMapping: z.array(z.object({
    shotId: z.string(),
    ttsText: z.string(),
  })),
});

export type VoiceOutput = z.infer<typeof voiceOutputSchema>;

// --- BGM Agent ---
export const bgmOutputSchema = z.object({
  bgm: z.object({
    createMusicParams: z.object({
      tags: z.array(z.string()),
      title: z.string(),
      promptText: z.string(),
      makeInstrumental: z.boolean(),
      duration: z.number().min(15).max(600),
    }),
    reasoning: z.string().nullable(),
    style: z.string().nullable(),
    prompt: z.string().nullable(),
  }),
});

export type BgmOutput = z.infer<typeof bgmOutputSchema>;

// --- Media Agent ---
export const mediaOutputSchema = z.object({
  media: z.object({
    shots: z.array(z.object({
      shotId: z.string(),
      sceneTitle: z.string(),
      imageToImagePromptText: z.string(),
      imageToVideoPromptText: z.string(),
    })),
  }),
});

export type MediaOutput = z.infer<typeof mediaOutputSchema>;
