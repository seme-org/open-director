import { resolveVoiceForGender } from "@/server/agent/voices";
import type { PublicArtStyle } from "@/server/agent/art-styles";
import type { PublicVoice } from "@/server/agent/voices";
import type { DirectorIntent, DirectorRecipe } from "@/server/agent/schemas/recipe";

function demoArtStyle(catalog: PublicArtStyle[] = []) {
  const style =
    catalog.find((item) => item.name === "Ghibli-style") ?? catalog[0];
  return {
    name: style?.name ?? "Demo storyboard style",
    promptPrefix:
      style?.promptPrefix ??
      "cinematic editorial storyboard frame, warm clear lighting",
    description: style?.description ?? "Demo style used only without a model.",
    keywords: style?.keywords ?? ["demo", "storyboard"],
    imageUrl: style?.imageUrl ?? null,
    reasoning: "Demo fallback style. Enable only for local no-model demos.",
    detail: style?.description ?? "Demo style used only without a model.",
    imagePrompt:
      style?.promptPrefix ??
      "cinematic editorial storyboard frame, warm clear lighting",
  };
}

export function isDemoRecipeFallbackEnabled() {
  return process.env.OPEN_DIRECTOR_DEMO_FALLBACK === "true";
}

export function assertCanGenerateRecipeWithModel() {
  if (!process.env.OPENAI_API_KEY && !isDemoRecipeFallbackEnabled()) {
    throw new Error(
      "OPENAI_API_KEY is required for recipe generation. Set OPEN_DIRECTOR_DEMO_FALLBACK=true only for local demo mode.",
    );
  }
}

export function buildDemoRecipeWithoutModel(
  prompt: string,
  intent: DirectorIntent,
  catalog: PublicArtStyle[] = [],
  voiceCatalog: PublicVoice[] = [],
): DirectorRecipe {
  const artStyle = demoArtStyle(catalog);
  const narratorVoice = resolveVoiceForGender(voiceCatalog, "female");
  return {
    intent,
    title: prompt.slice(0, 80) || "OpenDirector video",
    summary: `A concise video story based on: ${prompt}`,
    fullStory: `Open with the strongest promise from: ${prompt}. Then show the idea developing through one clear choice or discovery. End with the final value, takeaway, or call to action.`,
    agentBriefs: {
      script_agent: "Demo fallback script follows the user's prompt as a short speakable story.",
      art_style_agent: "Use the selected catalog visual style consistently.",
      storyboard_agent: "Cut the full story into one shot per story beat without local filler expansion.",
      character_agent: "Create only reusable foreground subjects that need visual consistency.",
      location_agent: "Create only important unoccupied locations from the story.",
      voice_agent: "Use one short narrator sentence per shot and do not use visual descriptions as TTS.",
      media_agent: "Generate one image prompt and one motion-only video prompt for each shot.",
    },
    highlights: [
      {
        title: "Highlight 1: Immediate hook",
        body: "Open with the central problem or promise so the audience understands the story stakes right away.",
      },
      {
        title: "Highlight 2: Clear turning point",
        body: "Use the middle beat to show a concrete choice, discovery, or contrast that changes the story direction.",
      },
      {
        title: "Highlight 3: Visual payoff",
        body: "End on a memorable image that resolves the idea and gives the sequence a clean emotional finish.",
      },
    ],
    audience: "General online audience",
    tone: "cinematic, clear, emotionally precise",
    language: /[\u4e00-\u9fa5]/.test(prompt) ? "zh-CN" : "en",
    artStyle,
    characters: [
      {
        name: "Main subject",
        description:
          "The central person, product, or idea from the user's brief.",
        promptText:
          "Main subject, single subject design sheet, front view, clean background, consistent cinematic editorial style.",
        type: "character",
        gender: "unknown",
        voiceId: narratorVoice.voiceId,
        imageUrl: null,
        voice: narratorVoice.detail || narratorVoice.name,
      },
    ],
    locations: [
      {
        name: "Demo studio",
        description:
          "A clean, flexible environment for staging the demo story beats.",
        promptText:
          "clean flexible demo studio environment, clear open space for later subject placement, cinematic editorial lighting",
        type: "indoor",
        imageUrl: null,
      },
    ],
    scenes: [
      {
        title: "Hook",
        desc: "Opening beat",
        script: `Open with the strongest promise or image from: ${prompt}`,
        visualPrompt:
          "A compelling opening frame that makes the idea instantly legible",
        audioPrompt: "Subtle pulse, clear narrator entrance",
        duration: 5,
        shots: [
          {
            shotId: "scene01_shot01",
            title: "Hook image",
            description: `Open with the strongest promise or image from: ${prompt}`,
            characters: ["Main subject"],
            visualElements:
              "Clear hero subject, legible action, simple background",
            dialogue: [
              {
                speaker: "narrator",
                text: `Open with the strongest promise or image from: ${prompt}`,
              },
            ],
          },
        ],
      },
      {
        title: "Build",
        desc: "Development beat",
        script:
          "Show the idea becoming a concrete sequence of actions, scenes, and decisions.",
        visualPrompt: "Storyboard panels expanding into a production timeline",
        audioPrompt: "Rising texture with restrained percussion",
        duration: 7,
        shots: [
          {
            shotId: "scene02_shot01",
            title: "Build progression",
            description:
              "Show the idea becoming a concrete sequence of actions, scenes, and decisions.",
            characters: ["Main subject"],
            visualElements:
              "Subject in action, visible progression, cinematic framing",
            dialogue: [
              {
                speaker: "narrator",
                text: "Show the idea becoming a concrete sequence of actions, scenes, and decisions.",
              },
            ],
          },
        ],
      },
      {
        title: "Payoff",
        desc: "Resolution beat",
        script: "Resolve with the final value, takeaway, or call to action.",
        visualPrompt:
          "Final polished frame with clear emotional or practical payoff",
        audioPrompt: "Clean final chord with concise narration",
        duration: 6,
        shots: [
          {
            shotId: "scene03_shot01",
            title: "Payoff",
            description:
              "Resolve with the final value, takeaway, or call to action.",
            characters: ["Main subject"],
            visualElements: "Final polished frame with clear payoff",
            dialogue: [
              {
                speaker: "narrator",
                text: "Resolve with the final value, takeaway, or call to action.",
              },
            ],
          },
        ],
      },
    ],
    bgm: {
      createMusicParams: {
        tags: [
          "background music",
          "modern cinematic bed",
          "warm",
          "understated",
          "steady pulse",
          "suitable for narration",
        ],
        title: "Background music",
        promptText: "   ",
        makeInstrumental: true,
        duration: 30,
      },
      reasoning:
        "Warm understated music supports narration without distracting from the story.",
      style: "modern cinematic bed",
      prompt: "warm, understated, steady pulse, no distracting melody",
    },
    media: {
      shots: [
        {
          shotId: "scene01_shot01",
          sceneTitle: "Hook",
          imageToImagePromptText:
            "@Main subject, compelling opening frame, make the idea instantly legible, cinematic editorial storyboard frame",
          imageToVideoPromptText:
            "Slow push-in on the main subject, subtle environmental motion, stable composition, no text, no watermark.",
        },
        {
          shotId: "scene02_shot01",
          sceneTitle: "Build",
          imageToImagePromptText:
            "@Main subject, storyboard panels expanding into a production timeline, cinematic editorial frame",
          imageToVideoPromptText:
            "Smooth lateral camera motion following the progression, restrained parallax, no text, no watermark.",
        },
        {
          shotId: "scene03_shot01",
          sceneTitle: "Payoff",
          imageToImagePromptText:
            "@Main subject, final polished frame with clear emotional or practical payoff, cinematic editorial frame",
          imageToVideoPromptText:
            "Gentle pullback into a composed final frame, clean ending beat, no text, no watermark.",
        },
      ],
    },
    mediaPlan: [
      {
        sceneTitle: "Hook",
        assetType: "video",
        prompt:
          "Slow push-in on the main subject, subtle environmental motion, stable composition, no text, no watermark.",
      },
      {
        sceneTitle: "Build",
        assetType: "video",
        prompt:
          "Smooth lateral camera motion following the progression, restrained parallax, no text, no watermark.",
      },
      {
        sceneTitle: "Payoff",
        assetType: "voice",
        prompt: "Record the final concise narration.",
      },
    ],
  };
}
