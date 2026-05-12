import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./shared", () => ({
  createModel: vi.fn(),
  sendAgentProgress: vi.fn((_writer: unknown, agentName: string, status: string, extra?: Record<string, unknown>) => {}),
  mergeRecipe: (base: Record<string, unknown>, patch: Record<string, unknown>) => ({ ...base, ...patch }),
  sleep: vi.fn(() => Promise.resolve()),
  resolveLanguage: vi.fn(() => undefined),
  languageInstruction: vi.fn(() => ""),
  callStructuredWithRetry: vi.fn(async (llm: { stream: (msgs: unknown[]) => AsyncIterable<unknown> }, msgs: unknown[]) => {
    const stream = await llm.stream(msgs);
    let partial: Record<string, unknown> | undefined;
    for await (const chunk of stream) {
      partial = { ...partial, ...(chunk as Record<string, unknown>) };
    }
    if (!partial) throw new Error("Empty LLM response");
    return partial;
  }),
}));

vi.mock("@/server/agent/art-styles", () => ({
  loadPublicArtStyles: vi.fn(() => Promise.resolve([
    {
      id: "style-1",
      name: "Ghibli-style",
      category: "2D Animation",
      promptPrefix: "Studio Ghibli style 2D",
      description: "Warm, Cozy, Hand-drawn 2D",
      keywords: ["ghibli", "2d"],
      imageUrl: "/images/ghibli.png",
    },
  ])),
  artStylePromptLines: (styles: Array<{ name: string; description: string; promptPrefix: string; keywords: string[] }>) =>
    styles.map((s) => `- ${s.name}: ${s.description}; promptPrefix: ${s.promptPrefix}; keywords: ${s.keywords.join(", ")}`).join("\n"),
  resolveArtStyleFromCatalog: (_catalog: unknown, name: string | null | undefined) => ({
    name: name || "Ghibli-style",
    promptPrefix: "Studio Ghibli style 2D",
    description: "Warm, Cozy, Hand-drawn 2D",
    keywords: ["ghibli", "2d"],
    imageUrl: "/images/ghibli.png",
  }),
}));

vi.mock("@/server/agent/voices", () => ({
  loadAvailableVoices: vi.fn(() => Promise.resolve([])),
  resolveVoiceById: vi.fn(() => null),
  resolveVoiceForGender: vi.fn(() => null),
  voicePromptLines: vi.fn(() => ""),
}));

vi.mock("@/server/agent/utils/recipe-persist", () => ({
  persistDirectorWorkflow: vi.fn(() => Promise.resolve({
    threadId: "test-thread",
    recipe: {},
    recipeId: "test-recipe-id",
    blockCount: 0,
    toolCallIds: [],
  })),
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    thread: { update: vi.fn(), create: vi.fn() },
    recipe: { create: vi.fn(() => ({ id: "test-recipe-id" })) },
    block: { deleteMany: vi.fn(), createMany: vi.fn() },
    agentState: { upsert: vi.fn() },
    toolCall: { create: vi.fn() },
  },
}));

import { createModel, sendAgentProgress, resolveLanguage, languageInstruction, callStructuredWithRetry } from "./shared";
import { scriptAgentNode } from "./script-agent";
import { artStyleAgentNode } from "./art-style-agent";
import { storyboardAgentNode } from "./storyboard-agent";
import { characterAgentNode } from "./character-agent";
import { locationAgentNode } from "./location-agent";
import { voiceAgentNode } from "./voice-agent";
import { bgmAgentNode } from "./bgm-agent";
import { mediaAgentNode } from "./media-agent";

function mockStream(chunks: Record<string, unknown>[]) {
  return (async function* () {
    for (const chunk of chunks) {
      yield chunk;
    }
  })();
}

function setupMockLLM(chunks: Record<string, unknown>[]) {
  const mockLLM = {
    withStructuredOutput: vi.fn().mockReturnValue({
      stream: vi.fn(() => mockStream(chunks)),
    }),
  };
  (createModel as ReturnType<typeof vi.fn>).mockReturnValue(mockLLM);
  return mockLLM;
}

function makeState(overrides: Record<string, unknown> = {}) {
  return {
    goal: "Make a story about a brave pony",
    threadId: "thread-1",
    userId: "user-1",
    recipe: {},
    messages: [],
    ...overrides,
  } as any;
}

function mockWriter() {
  return { write: vi.fn(), controller: {}, encoder: new TextEncoder(), writeText: vi.fn(), close: vi.fn() } as unknown as import("../../sse-writer").SSEWriter;
}

describe("recipe agent nodes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- script_agent ---
  describe("scriptAgentNode", () => {
    it("generates script and merges into recipe", async () => {
      const output = {
        title: "Brave Pony",
        summary: "A pony goes on an adventure.",
        fullStory: "A brave pony sets out to find friends.",
        highlights: [{ title: "Hook", body: "Pony leaves home" }],
        agentBriefs: {
          script_agent: "",
          art_style_agent: "",
          storyboard_agent: "",
          character_agent: "",
          location_agent: "",
          voice_agent: "",
          media_agent: "",
        },
        audience: "kids",
        tone: "warm",
        language: "en",
      };
      setupMockLLM([output]);

      const result = await scriptAgentNode(makeState());

      expect(result.recipe).toMatchObject({ title: "Brave Pony", fullStory: "A brave pony sets out to find friends." });
      expect(result.currentStep).toBe("script_agent");
    });

    it("preserves existing recipe fields when merging", async () => {
      const output = { title: "Brave Pony", summary: "A summary.", fullStory: "Story.", highlights: [], agentBriefs: { script_agent: "", art_style_agent: "", storyboard_agent: "", character_agent: "", location_agent: "", voice_agent: "", media_agent: "" }, audience: "kids", tone: "warm", language: "en" };
      setupMockLLM([output]);

      const result = await scriptAgentNode(makeState({ recipe: { artStyle: { name: "Ghibli" } } }));

      expect(result.recipe).toMatchObject({ artStyle: { name: "Ghibli" }, title: "Brave Pony" });
    });

    it("returns error when LLM produces no output", async () => {
      setupMockLLM([]);

      const result = await scriptAgentNode(makeState());
      expect(result.error).toBe("Empty LLM response");
      expect(result.currentStep).toBe("error");
    });

    it("sends SSE progress events", async () => {
      const output = { title: "T", summary: "S", fullStory: "F", highlights: [], agentBriefs: { script_agent: "", art_style_agent: "", storyboard_agent: "", character_agent: "", location_agent: "", voice_agent: "", media_agent: "" }, audience: "k", tone: "w", language: "en" };
      setupMockLLM([output]);
      const writer = mockWriter();

      await scriptAgentNode(makeState(), { configurable: { writer } });

      expect(sendAgentProgress).toHaveBeenCalledWith(writer, "script_agent", "running");
      expect(sendAgentProgress).toHaveBeenCalledWith(writer, "script_agent", "completed");
    });
  });

  // --- art_style_agent ---
  describe("artStyleAgentNode", () => {
    it("generates art style from catalog", async () => {
      const output = {
        artStyle: {
          name: "Ghibli-style",
          promptPrefix: "Studio Ghibli style 2D",
          description: "Warm, Cozy",
          keywords: ["ghibli"],
          imageUrl: "/images/ghibli.png",
          reasoning: "Matches warm tone",
          detail: "Warm, Cozy",
          imagePrompt: "Studio Ghibli style 2D",
        },
      };
      setupMockLLM([output]);

      const result = await artStyleAgentNode(makeState({ recipe: { fullStory: "A pony adventure." } }));

      expect(result.recipe).toMatchObject({ artStyle: { name: "Ghibli-style" } });
      expect(result.currentStep).toBe("art_style_agent");
    });

    it("returns error when LLM produces no output", async () => {
      setupMockLLM([]);

      const result = await artStyleAgentNode(makeState());
      expect(result.error).toBe("Empty LLM response");
      expect(result.currentStep).toBe("error");
    });
  });

  // --- storyboard_agent ---
  describe("storyboardAgentNode", () => {
    it("generates scenes with shots", async () => {
      const output = {
        scenes: [
          {
            title: "Opening",
            desc: null,
            script: "The pony looks out.",
            visualPrompt: "Pony at window",
            audioPrompt: "Gentle music",
            duration: 5,
            shots: [
              {
                shotId: "s1",
                title: "Window gaze",
                description: "Pony looks out the window",
                characters: ["Pony"],
                visualElements: "Window, morning light",
                dialogue: [{ speaker: "Pony", text: "What a beautiful day!" }],
              },
            ],
          },
          {
            title: "Journey",
            desc: null,
            script: "The pony walks through forest.",
            visualPrompt: "Forest path",
            audioPrompt: "Footsteps",
            duration: 5,
            shots: [],
          },
          {
            title: "Arrival",
            desc: null,
            script: "Pony finds friends.",
            visualPrompt: "Meadow",
            audioPrompt: "Celebration",
            duration: 5,
            shots: [],
          },
        ],
      };
      setupMockLLM([output]);

      const result = await storyboardAgentNode(makeState({ recipe: { fullStory: "A pony adventure.", artStyle: { name: "Ghibli" } } }));

      expect(result.recipe).toHaveProperty("scenes");
      expect((result.recipe as any).scenes).toHaveLength(3);
      expect((result.recipe as any).scenes[0].shots[0].shotId).toBe("s1");
      expect(result.currentStep).toBe("storyboard_agent");
    });

    it("returns error when LLM produces no output", async () => {
      setupMockLLM([]);

      const result = await storyboardAgentNode(makeState());
      expect(result.error).toBe("Empty LLM response");
      expect(result.currentStep).toBe("error");
    });
  });

  // --- character_agent ---
  describe("characterAgentNode", () => {
    it("generates characters with required entity matching", async () => {
      const output = {
        characters: [
          {
            name: "Pony",
            description: "A brave pony",
            promptText: "Brave pony, brown fur, big eyes, clean background",
            type: "character",
            gender: "unknown",
            voiceId: "Calm_Woman",
            voice: "Warm",
            imageUrl: null,
          },
        ],
      };
      setupMockLLM([output]);

      const state = makeState({
        recipe: {
          fullStory: "A pony adventure.",
          artStyle: { name: "Ghibli" },
          scenes: [{ title: "S1", shots: [{ shotId: "s1", characters: ["Pony"] }] }],
        },
      });

      const result = await characterAgentNode(state);

      expect((result.recipe as any).characters).toHaveLength(1);
      expect((result.recipe as any).characters[0].name).toBe("Pony");
      expect(result.currentStep).toBe("character_agent");
    });

    it("returns error when LLM produces no output", async () => {
      setupMockLLM([]);

      const result = await characterAgentNode(makeState());
      expect(result.error).toBe("Empty LLM response");
      expect(result.currentStep).toBe("error");
    });
  });

  // --- location_agent ---
  describe("locationAgentNode", () => {
    it("generates locations from story", async () => {
      const output = {
        locations: [
          {
            name: "Forest",
            description: "A dense forest with tall trees",
            promptText: "Dense forest, tall trees, dappled sunlight, no characters",
            type: "outdoor",
            imageUrl: null,
          },
        ],
      };
      setupMockLLM([output]);

      const result = await locationAgentNode(makeState({ recipe: { fullStory: "Pony goes into a forest.", artStyle: { name: "Ghibli" } } }));

      expect((result.recipe as any).locations).toHaveLength(1);
      expect((result.recipe as any).locations[0].name).toBe("Forest");
      expect(result.currentStep).toBe("location_agent");
    });

    it("returns error when LLM produces no output", async () => {
      setupMockLLM([]);

      const result = await locationAgentNode(makeState());
      expect(result.error).toBe("Empty LLM response");
      expect(result.currentStep).toBe("error");
    });
  });

  // --- voice_agent ---
  describe("voiceAgentNode", () => {
    it("generates TTS text from storyboard shots", async () => {
      const output = {
        voiceMapping: [
          { shotId: "s1", ttsText: "What a beautiful day!" },
          { shotId: "s2", ttsText: "Let me explore the forest." },
        ],
      };
      setupMockLLM([output]);

      const state = makeState({
        recipe: {
          scenes: [
            {
              title: "Opening",
              shots: [
                { shotId: "s1", description: "Pony looks out", dialogue: [{ speaker: "Pony", text: "What a beautiful day!" }] },
                { shotId: "s2", description: "Pony walks", dialogue: [] },
              ],
            },
          ],
        },
      });

      const result = await voiceAgentNode(state);

      expect((result.recipe as any).scenes[0].shots[0].ttsText).toBe("What a beautiful day!");
      expect(result.currentStep).toBe("voice_agent");
    });

    it("returns error when LLM produces no output", async () => {
      setupMockLLM([]);

      const result = await voiceAgentNode(makeState());
      expect(result.error).toBe("Empty LLM response");
      expect(result.currentStep).toBe("error");
    });
  });

  // --- bgm_agent ---
  describe("bgmAgentNode", () => {
    it("generates BGM params from story context", async () => {
      const output = {
        bgm: {
          createMusicParams: {
            tags: ["warm", "adventure"],
            title: "Pony Journey",
            promptText: "   ",
            makeInstrumental: true,
            duration: 15,
          },
          reasoning: "Warm adventure music fits the story",
          style: "warm",
          prompt: "warm adventure",
        },
      };
      setupMockLLM([output]);

      const state = makeState({
        recipe: {
          fullStory: "A pony adventure.",
          scenes: [{ title: "S1", duration: 5 }, { title: "S2", duration: 5 }, { title: "S3", duration: 5 }],
        },
      });

      const result = await bgmAgentNode(state);

      expect((result.recipe as any).bgm.createMusicParams.tags).toEqual(["warm", "adventure"]);
      expect((result.recipe as any).bgm.createMusicParams.duration).toBe(15);
      expect(result.currentStep).toBe("bgm_agent");
    });

    it("returns error when LLM produces no output", async () => {
      setupMockLLM([]);

      const result = await bgmAgentNode(makeState());
      expect(result.error).toBe("Empty LLM response");
      expect(result.currentStep).toBe("error");
    });
  });

  // --- media_agent ---
  describe("mediaAgentNode", () => {
    it("generates media prompts for each shot", async () => {
      const output = {
        media: {
          shots: [
            {
              shotId: "s1",
              sceneTitle: "Opening",
              imageToImagePromptText: "Studio Ghibli style, @Pony looking out window",
              imageToVideoPromptText: "Camera slowly zooms in on pony",
            },
          ],
        },
      };
      setupMockLLM([output]);

      const state = makeState({
        recipe: {
          scenes: [
            {
              title: "Opening",
              shots: [{ shotId: "s1", description: "Pony at window", characters: ["Pony"], visualElements: "Window" }],
            },
          ],
          characters: [{ name: "Pony", promptText: "Brave pony" }],
          locations: [{ name: "House", promptText: "Cozy house" }],
          artStyle: { promptPrefix: "Studio Ghibli style" },
        },
      });

      const result = await mediaAgentNode(state);

      expect((result.recipe as any).media.shots).toHaveLength(1);
      expect((result.recipe as any).media.shots[0].imageToImagePromptText).toContain("@Pony");
      expect(result.currentStep).toBe("media_agent");
    });

    it("returns error when LLM produces no output", async () => {
      setupMockLLM([]);

      const result = await mediaAgentNode(makeState());
      expect(result.error).toBe("Empty LLM response");
      expect(result.currentStep).toBe("error");
    });
  });

  // --- streaming behavior ---
  describe("streaming", () => {
    it("writes final recipe after callStructuredWithRetry completes", async () => {
      const chunks = [
        { title: "Brave Pony" },
        { summary: "A pony adventure." },
        { fullStory: "Full story text." },
      ];
      setupMockLLM(chunks);
      const writer = mockWriter();

      await scriptAgentNode(makeState(), { configurable: { writer } });

      const recipeWrites = (writer.write as ReturnType<typeof vi.fn>).mock.calls
        .filter((call: unknown[]) => (call as any[])[0] === "recipe");
      expect(recipeWrites.length).toBeGreaterThanOrEqual(1);
    });
  });
});
