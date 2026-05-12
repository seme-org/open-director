import { z } from "zod";
import type { AspectRatio } from "@/server/agent/media-provider";

export const sceneSchema = z.object({
  title: z.string(),
  desc: z.string().nullable(),
  script: z.string(),
  visualPrompt: z.string(),
  audioPrompt: z.string(),
  duration: z.number().min(2).max(30),
  shots: z.array(
    z.object({
      shotId: z.string(),
      title: z.string(),
      description: z.string(),
      characters: z.array(z.string()),
      visualElements: z.string(),
      dialogue: z.array(z.object({ speaker: z.string(), text: z.string() })),
    }),
  ),
});

export const locationSchema = z.object({
  name: z.string(),
  description: z.string(),
  promptText: z.string(),
  type: z.string(),
  imageUrl: z.string().nullable(),
});

export const recipeSchema = z.object({
  intent: z.literal(["story"]),
  title: z.string(),
  summary: z.string(),
  fullStory: z.string(),
  agentBriefs: z.object({
    script_agent: z.string(),
    art_style_agent: z.string(),
    storyboard_agent: z.string(),
    character_agent: z.string(),
    location_agent: z.string(),
    voice_agent: z.string(),
    media_agent: z.string(),
  }),
  highlights: z.array(
    z.object({
      title: z.string(),
      body: z.string(),
    }),
  ).max(3),
  audience: z.string(),
  tone: z.string(),
  language: z.string(),
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
  characters: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      promptText: z.string(),
      type: z.enum(["character", "object"]),
      gender: z.enum(["male", "female", "unknown"]),
      voiceId: z.string().nullable(),
      voice: z.string().nullable(),
      imageUrl: z.string().nullable(),
    }),
  ),
  locations: z.array(locationSchema),
  scenes: z.array(sceneSchema).min(3).max(8),
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
  media: z.object({
    shots: z.array(
      z.object({
        shotId: z.string(),
        sceneTitle: z.string(),
        imageToImagePromptText: z.string(),
        imageToVideoPromptText: z.string(),
      }),
    ),
  }),
  mediaPlan: z.array(
    z.object({
      sceneTitle: z.string(),
      assetType: z.enum(["image", "video", "audio", "voice"]),
      prompt: z.string(),
    }),
  ),
});

export type DirectorRecipe = z.infer<typeof recipeSchema>;
export type DirectorIntent = DirectorRecipe["intent"];
export type DirectorRecipeWithAspectRatio = DirectorRecipe & { aspectRatio?: AspectRatio };

type JsonSchemaNode = {
  type?: string | string[];
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
  items?: JsonSchemaNode;
  anyOf?: JsonSchemaNode[];
  oneOf?: JsonSchemaNode[];
  allOf?: JsonSchemaNode[];
  default?: unknown;
};

export function assertRecipeSchemaStructuredOutputCompatible() {
  const schema = z.toJSONSchema(recipeSchema) as JsonSchemaNode;
  assertStrictObjectSchema(schema, "recipe");
}

function assertStrictObjectSchema(schema: JsonSchemaNode, path: string) {
  if (Object.prototype.hasOwnProperty.call(schema, "default")) {
    throw new Error(
      `${path} includes JSON Schema default, which strict structured outputs reject.`,
    );
  }

  if (schema.properties) {
    const required = new Set(schema.required ?? []);
    const missing = Object.keys(schema.properties).filter(
      (key) => !required.has(key),
    );
    if (missing.length) {
      throw new Error(
        `${path} is missing required keys: ${missing.join(", ")}`,
      );
    }
    for (const [key, child] of Object.entries(schema.properties)) {
      assertStrictObjectSchema(child, `${path}.${key}`);
    }
  }

  if (schema.items) assertStrictObjectSchema(schema.items, `${path}[]`);
  for (const key of ["anyOf", "oneOf", "allOf"] as const) {
    for (const child of schema[key] ?? []) {
      assertStrictObjectSchema(child, `${path}.${key}`);
    }
  }
}

export type DirectorWorkflowResult = {
  threadId: string;
  recipe: DirectorRecipe;
  recipeId: string;
  blockCount: number;
  toolCallIds: string[];
};
