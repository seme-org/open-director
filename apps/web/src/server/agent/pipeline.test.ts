import { describe, expect, it, vi } from "vitest";
import { assertRecipeSchemaStructuredOutputCompatible, type DirectorRecipe } from "./schemas/recipe";
import { buildDirectorBrief } from "./utils/director-brief";
import { chunkAssistantText } from "./utils/text-stream";
import { buildStoryboardBlocks, planCreationEditorAssetTasks, planCreationPreparationTasks, planPlanningAudioTasks, planPlanningSceneImageTasks, planPlanningSubjectTasks, planRunnerTasks, parseRunnerExecutionState } from "./utils/task-planner";
import { confirmedDirectorBriefPrompt, extractAspectRatioFromPrompt, isCreateVideoCommand, isDirectorBriefConfirmation } from "./utils/commands";
import { buildRecipeGeneratorFailureState } from "./utils/recipe-persist";
import { scriptAgentPrompt } from "./graph/nodes/prompts/script";
import { artStyleAgentPrompt } from "./graph/nodes/prompts/art-style";
import { characterAgentPrompt } from "./graph/nodes/prompts/character";
import { locationAgentPrompt } from "./graph/nodes/prompts/location";
import { resolveFixedArtStyle } from "./utils/recipe-normalize";

vi.mock("@/server/db/prisma", () => ({
  prisma: {},
}));

const emptyAgentBriefs: DirectorRecipe["agentBriefs"] = {
  script_agent: "",
  art_style_agent: "",
  storyboard_agent: "",
  character_agent: "",
  location_agent: "",
  voice_agent: "",
  media_agent: "",
};

describe("director pipeline runner planning", () => {
  it("keeps the recipe schema compatible with strict OpenAI structured outputs", () => {
    expect(() => assertRecipeSchemaStructuredOutputCompatible()).not.toThrow();
  });

  it("recognizes explicit create video commands separately from story prompts", () => {
    expect(isCreateVideoCommand("创作视频")).toBe(true);
    expect(isCreateVideoCommand("开始创作视频")).toBe(true);
    expect(isCreateVideoCommand("create video")).toBe(true);
    expect(isCreateVideoCommand("我想做小马过河的故事")).toBe(false);
  });

  it("chunks fixed assistant text for visible streaming", () => {
    expect(chunkAssistantText("导演简报已准备好。请先确认简报。", 6)).toEqual([
      "导演简报已准",
      "备好。请先确",
      "认简报。",
    ]);
    expect(chunkAssistantText("短句", 6)).toEqual(["短句"]);
  });

  it("preserves voice parameters when restoring persisted runner tasks", () => {
    expect(
      parseRunnerExecutionState({
        recipeId: "recipe-1",
        runnerTasks: [
          {
            id: "voice-1",
            tool: "tts_create",
            sceneTitle: "Hook",
            prompt: "Hello",
            voiceId: "Calm_Woman",
            emotion: "happy",
            speed: 1.1,
            pitch: 0,
            volume: 1,
          },
        ],
      }).tasks,
    ).toEqual([
      expect.objectContaining({
        id: "voice-1",
        voiceId: "Calm_Woman",
        emotion: "happy",
        speed: 1.1,
        pitch: 0,
        volume: 1,
      }),
    ]);
  });

  it("requires an explicit director brief confirmation payload before continuing the workflow", () => {
    expect(
      isDirectorBriefConfirmation({
        confirmDirectorBrief: true,
        directorBrief: { title: "Director Brief" },
      }),
    ).toBe(true);
    expect(isDirectorBriefConfirmation({ confirmDirectorBrief: true })).toBe(
      false,
    );
    expect(
      isDirectorBriefConfirmation({
        directorBrief: { title: "Director Brief" },
      }),
    ).toBe(false);
    expect(
      isDirectorBriefConfirmation({
        confirmDirectorBrief: false,
        directorBrief: { title: "Director Brief" },
      }),
    ).toBe(false);
  });

  it("records recipe generator stream failures as a resumable agent state", () => {
    expect(
      buildRecipeGeneratorFailureState({
        threadId: "thread-1",
        prompt: "小马过河",
        intent: "story",
        directorBrief: { project_name: "小马过河" },
        error: new Error("terminated"),
        partialRecipe: { title: "小马过河" },
      }),
    ).toMatchObject({
      where: { threadId: "thread-1" },
      update: {
        currentStep: "recipe_generator_failed",
        state: {
          current_node: "recipe_generator",
          goal: "小马过河",
          intent: "story",
          directorBrief: { project_name: "小马过河" },
          partialRecipe: { title: "小马过河" },
          error: "terminated",
          retryable: true,
        },
      },
      create: {
        threadId: "thread-1",
        currentStep: "recipe_generator_failed",
        state: {
          current_node: "recipe_generator",
          goal: "小马过河",
          intent: "story",
          error: "terminated",
          retryable: true,
        },
      },
    });
  });

  it("includes edited director brief values in the confirmed recipe prompt", () => {
    expect(
      confirmedDirectorBriefPrompt("小马过河", {
        exam: {
          input_parameter: [
            { key: "aspect_ratio", label: "Aspect ratio", value: "9:16" },
          ],
          fill_blank: [{ key: "audience", label: "Audience", value: "儿童" }],
          single_choice: [],
          multi_choice: [],
        },
      }),
    ).toContain("- Audience: 儿童");
  });

  it("extracts the confirmed aspect ratio from the director brief prompt for persistence", () => {
    expect(extractAspectRatioFromPrompt("Confirmed single choices:\n- Aspect Ratio: 9:16")).toBe("9:16");
    expect(extractAspectRatioFromPrompt("Confirmed single choices:\n- Aspect Ratio: 1:1")).toBe("1:1");
    expect(extractAspectRatioFromPrompt("No explicit ratio")).toBeUndefined();
  });

  it("uses chat_agent full story script rules in the script agent prompt", () => {
    const prompt = scriptAgentPrompt("story");

    expect(prompt).toContain("professional story writer");
    expect(prompt).toContain("Summary");
    expect(prompt).toContain("Known stories / templates");
    expect(prompt).toContain("FULL_STORY format and length");
    expect(prompt).toContain("Output fullStory as plain story text");
    expect(prompt).toContain("Do NOT include scene or background descriptions");
    expect(prompt).toContain("Chinese: duration(min) x 120-220");
    expect(prompt).toContain("agentBriefs.voice_agent");
  });

  it("uses chat_agent art style selection rules in the art style agent prompt", () => {
    const prompt = artStyleAgentPrompt("story", [
      {
        id: "style-1",
        name: "Ghibli-style",
        category: "2D Animation",
        promptPrefix: "Studio Ghibli style 2D",
        description: "Warm, Cozy, Hand-drawn 2D",
        keywords: ["ghibli", "2d"],
        imageUrl: "/images/adv-style-images/ghibli-2d.png",
      },
    ]);

    expect(prompt).toContain("Visual Style Director");
    expect(prompt).toContain("Explicit Override");
    expect(prompt).toContain("mood, genre, era, palette, realism vs stylized");
    expect(prompt).toContain("MUST use one exact name");
    expect(prompt).toContain("Never invent a style name");
    expect(prompt).toContain("reasoning must be one sentence");
    expect(prompt).toContain("Ghibli-style");
  });

  it("uses chat_agent character and location rules in their respective prompts", () => {
    const charPrompt = characterAgentPrompt("story");
    const locPrompt = locationAgentPrompt("story");

    expect(charPrompt).toContain("Required Entities");
    expect(charPrompt).toContain("Names MUST match Required Entities exactly");
    expect(charPrompt).toContain("Do NOT create a narrator/voice-over entry");
    expect(charPrompt).toContain("Variant naming");
    expect(charPrompt).toContain("single-character, single-view sheet");

    expect(locPrompt).toContain("location_agent");
    expect(locPrompt).toContain("Use only the fullStory");
    expect(locPrompt).toContain("Don't create locations that aren't in the story");
    expect(locPrompt).toContain("unoccupied");
  });

  it("builds a story director brief with frontend portal creation options", () => {
    const brief = buildDirectorBrief("我想做一个恐怖故事", [
      {
        id: "as_0020",
        name: "Ghibli-style",
        category: "2D Animation",
        promptPrefix: "Studio Ghibli style 2D",
        description: "Warm, Cozy, Hand-drawn 2D",
        keywords: ["ghibli", "2d"],
        imageUrl: "/images/adv-style-images/ghibli-2d.png",
      },
    ]);

    expect(brief.intent).toBe("story");
    expect(brief.exam.input_parameter).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ key: "intent" })]),
    );
    expect(brief.exam.single_choice).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "aspect_ratio",
          label: "Aspect Ratio",
          options: [
            { value: "16:9", label: "16:9", default: 0 },
            { value: "9:16", label: "9:16", default: 1 },
            { value: "1:1", label: "1:1", default: 0 },
          ],
        }),
        expect.objectContaining({
          key: "language",
          label: "Language",
          options: expect.arrayContaining([
            { value: "zh-CN", label: "中文", default: 1 },
            { value: "en", label: "English", default: 0 },
          ]),
        }),
        expect.objectContaining({
          key: "art_style",
          label: "Art Style",
          options: [
            {
              value: "Ghibli-style",
              label: "Ghibli-style",
              default: 1,
              imageUrl: "/images/adv-style-images/ghibli-2d.png",
            },
          ],
        }),
        expect.objectContaining({
          key: "duration",
          label: "Video Duration",
          options: [
            { value: "15s", label: "15 seconds", default: 0 },
            { value: "30s", label: "30 seconds", default: 0 },
            { value: "45s", label: "45 seconds", default: 0 },
            { value: "60s", label: "60 seconds", default: 0 },
            { value: "90s", label: "90 seconds", default: 0 },
          ],
        }),
      ]),
    );
  });

  it("always treats the director brief as story intent", () => {
    expect(buildDirectorBrief("Make a product launch campaign").intent).toBe(
      "story",
    );
    expect(
      buildDirectorBrief("Make a tutorial").exam.single_choice.find(
        (choice) => choice.key === "aspect_ratio",
      ),
    ).toBeDefined();
  });

  it("prefills creation supplement fields from the original prompt", () => {
    const brief = buildDirectorBrief("我想做小马过河的故事");

    expect(brief.exam.fill_blank).toEqual([
      {
        key: "audience",
        label: "Audience",
        value: "亲子家庭、儿童与寓言故事观众",
      },
      { key: "must_include", label: "Must include", value: "小马过河" },
    ]);
  });

  it("uses AI director brief choices when a draft is provided", () => {
    const brief = buildDirectorBrief(
      "我想做小马过河的故事",
      [
        {
          id: "as_0020",
          name: "Ghibli-style",
          category: "2D Animation",
          promptPrefix: "Studio Ghibli style 2D",
          description: "Warm, Cozy, Hand-drawn 2D",
          keywords: ["ghibli", "2d"],
          imageUrl: "/images/adv-style-images/ghibli-2d.png",
        },
        {
          id: "as_0021",
          name: "Paper Cutout",
          category: "2D Animation",
          promptPrefix: "Layered paper cutout animation",
          description: "Tactile layered paper storybook",
          keywords: ["paper", "storybook"],
          imageUrl: "/images/adv-style-images/paper-cutout-2d.png",
        },
      ],
      {
        project_name: "小马过河",
        intent: "story",
        audience: "5-8 岁儿童与陪伴阅读的家长",
        must_include: "小马、河流、松鼠、老牛、自己尝试",
        language: "zh-CN",
        aspect_ratio: "1:1",
        art_style: "Paper Cutout",
        duration: "45s",
      },
    );

    expect(brief.project_name).toBe("小马过河");
    expect(brief.exam.fill_blank).toEqual([
      {
        key: "audience",
        label: "Audience",
        value: "5-8 岁儿童与陪伴阅读的家长",
      },
      {
        key: "must_include",
        label: "Must include",
        value: "小马、河流、松鼠、老牛、自己尝试",
      },
    ]);
    expect(
      brief.exam.single_choice.find((choice) => choice.key === "aspect_ratio")
        ?.options,
    ).toEqual([
      { value: "16:9", label: "16:9", default: 0 },
      { value: "9:16", label: "9:16", default: 0 },
      { value: "1:1", label: "1:1", default: 1 },
    ]);
    expect(
      brief.exam.single_choice.find((choice) => choice.key === "art_style")
        ?.options,
    ).toEqual([
      {
        value: "Ghibli-style",
        label: "Ghibli-style",
        default: 0,
        imageUrl: "/images/adv-style-images/ghibli-2d.png",
      },
      {
        value: "Paper Cutout",
        label: "Paper Cutout",
        default: 1,
        imageUrl: "/images/adv-style-images/paper-cutout-2d.png",
      },
    ]);
    expect(
      brief.exam.single_choice.find((choice) => choice.key === "duration")
        ?.options,
    ).toEqual([
      { value: "15s", label: "15 seconds", default: 0 },
      { value: "30s", label: "30 seconds", default: 0 },
      { value: "45s", label: "45 seconds", default: 1 },
      { value: "60s", label: "60 seconds", default: 0 },
      { value: "90s", label: "90 seconds", default: 0 },
    ]);
  });

  it("offers the chat-agent language set in the director brief", () => {
    const brief = buildDirectorBrief("Create a launch video");
    const languageChoice = brief.exam.single_choice.find(
      (choice) => choice.key === "language",
    );

    expect(languageChoice?.options.map((option) => option.value)).toEqual([
      "zh-CN",
      "en",
      "ja",
      "ko",
      "es",
      "fr",
      "de",
      "pt",
      "it",
      "ru",
      "ar",
      "hi",
    ]);
  });

  it("honors an edited non-English language selection in the confirmed prompt", () => {
    const confirmedPrompt = confirmedDirectorBriefPrompt(
      "Create a launch video",
      {
        exam: {
          input_parameter: [],
          fill_blank: [],
          single_choice: [
            {
              key: "language",
              label: "Language",
              options: [
                { value: "en", label: "English", default: 0 },
                { value: "fr", label: "Français", default: 1 },
              ],
            },
          ],
          multi_choice: [],
        },
      },
    );

    expect(
      buildDirectorBrief(confirmedPrompt).exam.single_choice.find(
        (choice) => choice.key === "language",
      )?.options,
    ).toEqual(
      expect.arrayContaining([{ value: "fr", label: "Français", default: 1 }]),
    );
  });

  it("uses database art style configs from the public catalog", () => {
    const publicCatalog = [
      {
        id: "as_0020",
        name: "Ghibli-style",
        category: "2D Animation",
        promptPrefix: "Studio Ghibli style 2D",
        description: "Warm, Cozy, Hand-drawn 2D",
        keywords: ["ghibli", "2d"],
        imageUrl: "/images/adv-style-images/ghibli-2d.png",
      },
    ];

    expect(resolveFixedArtStyle("Ghibli-style", publicCatalog)).toMatchObject({
      name: "Ghibli-style",
      promptPrefix: expect.stringContaining("Studio Ghibli style 2D"),
      keywords: expect.arrayContaining(["ghibli", "2d"]),
      imageUrl: "/images/adv-style-images/ghibli-2d.png",
    });
    expect(resolveFixedArtStyle("unknown", publicCatalog)).toMatchObject({
      name: "Ghibli-style",
    });
  });

  it("splits planning subject generation from first-click editor media preparation", () => {
    const recipe: DirectorRecipe = {
      intent: "story",
      title: "Test story",
      summary: "A test story summary.",
      fullStory: "A test story summary.",
      agentBriefs: emptyAgentBriefs,
      highlights: [
        { title: "Hook", body: "Clear opening hook." },
        { title: "Turn", body: "Clear turning point." },
        { title: "Payoff", body: "Clear visual payoff." },
      ],
      audience: "creators",
      tone: "cinematic",
      language: "en",
      artStyle: {
        name: "Editorial",
        promptPrefix: "editorial frame",
        description: "Natural light",
        keywords: ["editorial"],
        imageUrl: null,
        reasoning: null,
        detail: "Natural light",
        imagePrompt: "editorial frame",
      },
      characters: [
        {
          name: "Lead",
          description: "Main subject",
          promptText: "Lead, warm hero",
          type: "character",
          gender: "unknown",
          voiceId: "Calm_Woman",
          voice: "Warm",
          imageUrl: null,
        },
      ],
      locations: [
        {
          name: "Studio",
          description: "A clean production studio.",
          promptText: "clean production studio with soft editorial lighting",
          type: "indoor",
          imageUrl: null,
        },
      ],
      scenes: [
        {
          title: "Hook",
          desc: null,
          script: "Open",
          visualPrompt: "Frame",
          audioPrompt: "Pulse",
          duration: 5,
          shots: [],
        },
        {
          title: "Build",
          desc: null,
          script: "Build",
          visualPrompt: "Move",
          audioPrompt: "Rise",
          duration: 5,
          shots: [],
        },
        {
          title: "Payoff",
          desc: null,
          script: "End",
          visualPrompt: "Resolve",
          audioPrompt: "Chord",
          duration: 5,
          shots: [],
        },
      ],
      bgm: {
        createMusicParams: {
          tags: ["background music", "warm pulse"],
          title: "Warm bed",
          promptText: "   ",
          makeInstrumental: true,
          duration: 30,
        },
        reasoning: null,
        style: "warm",
        prompt: "warm pulse",
      },
      media: {
        shots: [
          {
            shotId: "scene01_shot01",
            sceneTitle: "Hook",
            imageToImagePromptText: "@Lead opening image",
            imageToVideoPromptText: "animated build shot",
          },
        ],
      },
      mediaPlan: [],
    };

    expect(planPlanningSubjectTasks(recipe)).toEqual([
      expect.objectContaining({
        id: "character-1",
        tool: "create_character",
        sceneTitle: "角色列表",
        status: "planned",
      }),
    ]);

    const recipeWithCharacterImage = {
      ...recipe,
      characters: [
        { ...recipe.characters[0], imageUrl: "https://cdn.test/lead.png" },
      ],
    };
    const blockTitles = buildStoryboardBlocks(recipe).map(
      (block) => block.title,
    );
    const sceneTitles = recipe.scenes.map((scene) => scene.title);

    expect(
      planCreationPreparationTasks(recipeWithCharacterImage).map(
        (task) => task.sceneTitle,
      ),
    ).toEqual(blockTitles);
    expect(
      planCreationPreparationTasks(recipeWithCharacterImage),
    ).toContainEqual(
      expect.objectContaining({
        id: "shot-1-image",
        tool: "image_to_image",
        sceneTitle: "Hook - Hook",
        status: "planned",
        dependsOn: ["scene-1-image"],
        referenceUrls: ["https://cdn.test/lead.png"],
      }),
    );

    expect(
      planPlanningSceneImageTasks(recipeWithCharacterImage).map(
        (task) => task.sceneTitle,
      ),
    ).toEqual([...sceneTitles, ...blockTitles]);
    expect(planPlanningSceneImageTasks(recipeWithCharacterImage)).toContainEqual(
      expect.objectContaining({
        id: "scene-1-image",
        tool: "create_location",
        sceneTitle: "Hook",
      }),
    );

    expect(planPlanningAudioTasks(recipe)).toEqual([
      ...blockTitles.map((title, index) =>
        expect.objectContaining({
          id: `voice-${index + 1}`,
          tool: "tts_create",
          sceneTitle: title,
          status: "planned",
          voiceId: "Calm_Woman",
        }),
      ),
      expect.objectContaining({
        id: "bgm-1",
        tool: "text_to_bgm",
        sceneTitle: "背景音乐",
        prompt: "background music, warm pulse",
        status: "planned",
      }),
    ]);
    expect(planPlanningAudioTasks(recipe).filter((task) => task.tool === "tts_create").map((task) => task.prompt)).toEqual([
      "Open",
      "Build",
      "End",
    ]);

      expect(
        planCreationEditorAssetTasks(recipeWithCharacterImage).map(
          (task) => task.sceneTitle,
        ),
      ).toEqual([...sceneTitles, ...blockTitles, ...blockTitles, "背景音乐"]);

      const recipeWithAspectRatio = {
        ...recipe,
        aspectRatio: "9:16",
      } as DirectorRecipe & { aspectRatio: "9:16" };

      expect(
        planRunnerTasks(recipeWithAspectRatio)
          .filter((task) =>
            ["create_character", "create_location", "image_to_image"].includes(task.tool),
          )
          .every((task) => (task as { aspectRatio?: string }).aspectRatio === "9:16"),
      ).toBe(true);

      expect(planRunnerTasks(recipe)).toEqual([
        expect.objectContaining({
          id: "character-1",
          tool: "create_character",
        sceneTitle: "角色列表",
        status: "planned",
      }),
      ...sceneTitles.map((title, index) =>
        expect.objectContaining({
          id: `scene-${index + 1}-image`,
          tool: "create_location",
          sceneTitle: title,
          status: "planned",
        }),
      ),
      expect.objectContaining({
        id: "bgm-1",
        tool: "text_to_bgm",
        sceneTitle: "背景音乐",
        prompt: "background music, warm pulse",
        status: "planned",
      }),
      ...blockTitles.map((title, index) =>
        expect.objectContaining({
          id: `shot-${index + 1}-image`,
          tool: "image_to_image",
          sceneTitle: title,
          status: "planned",
          dependsOn: [
            "character-1",
            `scene-${index + 1}-image`,
          ],
        }),
      ),
      ...blockTitles.map((title, index) =>
        expect.objectContaining({
          id: `voice-${index + 1}`,
          tool: "tts_create",
          sceneTitle: title,
          status: "planned",
        }),
      ),
    ]);
  });

  it("uses scene script for voiceover when a storyboard shot has no dialogue", () => {
    const recipe: DirectorRecipe = {
      intent: "story",
      title: "小马过河",
      summary: "小马出发寻找朋友。",
      fullStory: "小马出发寻找朋友。",
      agentBriefs: emptyAgentBriefs,
      highlights: [{ title: "出发", body: "小马开始旅程。" }],
      audience: "children",
      tone: "warm",
      language: "zh",
      artStyle: {
        name: "Children's Illustration",
        promptPrefix: "storybook",
        description: "Warm",
        keywords: ["storybook"],
        imageUrl: null,
        reasoning: null,
        detail: "Warm",
        imagePrompt: "storybook",
      },
      characters: [],
      locations: [],
      scenes: [
        {
          title: "小马的出发",
          desc: "在阳光灿烂的早晨，小马兴奋地出发了。",
          script: "小马在阳光下，兴奋地说：\"我一定能找到我的新朋友！\"",
          visualPrompt: "描绘小马在早晨阳光下的样子。",
          audioPrompt: "轻快的音乐，鸟鸣声。",
          duration: 15,
          shots: [
            {
              shotId: "shot1",
              title: "小马在草地上",
              description: "小马在草地上欢快奔跑。",
              characters: ["小马"],
              visualElements: "草地、太阳、花朵",
              dialogue: [],
            },
          ],
        },
      ],
      bgm: {
        createMusicParams: {
          tags: ["warm music"],
          title: "Warm bed",
          promptText: "",
          makeInstrumental: true,
          duration: 30,
        },
        reasoning: null,
        style: "warm",
        prompt: "warm music",
      },
      media: { shots: [] },
      mediaPlan: [],
    };

    expect(buildStoryboardBlocks(recipe)[0]?.script).toBe(
      "小马在阳光下，兴奋地说：\"我一定能找到我的新朋友！\"",
    );
    expect(
      planPlanningAudioTasks(recipe).find((task) => task.id === "voice-1")
        ?.prompt,
    ).toBe("小马在阳光下，兴奋地说：\"我一定能找到我的新朋友！\"");
  });

  it("builds scene image prompts as empty environment plates without subject names", () => {
    const recipe: DirectorRecipe = {
      intent: "story",
      title: "小马过河",
      summary: "小马过河的故事梗概。",
      fullStory: "小马来到河边，认真观察水流，最后找到办法继续前进。",
      agentBriefs: emptyAgentBriefs,
      highlights: [
        { title: "开场", body: "小马遇到明确阻碍。" },
        { title: "转折", body: "小马做出判断。" },
        { title: "收束", body: "小马完成过河。" },
      ],
      audience: "children",
      tone: "warm",
      language: "zh-CN",
      artStyle: {
        name: "Storybook",
        promptPrefix: "storybook illustration",
        description: "Warm picture book",
        keywords: ["storybook"],
        imageUrl: null,
        reasoning: null,
        detail: "Warm picture book",
        imagePrompt: "storybook illustration",
      },
      characters: [
        {
          name: "小马",
          description: "勇敢的小马",
          promptText: "brave pony character",
          type: "character",
          gender: "unknown",
          voiceId: "Calm_Woman",
          voice: "Warm",
          imageUrl: null,
        },
      ],
      locations: [
        {
          name: "河边",
          description: "清澈河水旁的开阔河岸。",
          promptText: "开阔河岸，清澈河水，草地和柔和阳光，适合角色后续放置",
          type: "outdoor",
          imageUrl: null,
        },
      ],
      scenes: [
        {
          title: "小马在河边",
          desc: "小马站在宽阔的河流旁，想要过河。",
          script: "小马在河边观察宽阔的河流，想要过河。",
          visualPrompt: "小马站在河边，阳光照着清澈河水和草地。",
          audioPrompt: "流水声",
          duration: 8,
          shots: [],
        },
        {
          title: "山坡上的小路",
          desc: "远山、草地和蜿蜒小路。",
          script: "小路通向远山。",
          visualPrompt: "远山、草地和蜿蜒小路。",
          audioPrompt: "风声",
          duration: 8,
          shots: [],
        },
        {
          title: "河岸全景",
          desc: "河岸、浅水、草地和远处树林。",
          script: "河岸很安静。",
          visualPrompt: "河岸、浅水、草地和远处树林。",
          audioPrompt: "流水声",
          duration: 8,
          shots: [],
        },
      ],
      bgm: {
        createMusicParams: {
          tags: ["warm", "storybook"],
          title: "Warm",
          promptText: "   ",
          makeInstrumental: true,
          duration: 30,
        },
        reasoning: null,
        style: "warm",
        prompt: "warm",
      },
      media: { shots: [] },
      mediaPlan: [],
    };

    const scenePrompt = planPlanningSceneImageTasks(recipe).find(
      (task) => task.id === "scene-1-image",
    )?.prompt;

    expect(scenePrompt).toContain("EMPTY ENVIRONMENT PLATE");
    expect(scenePrompt).toContain("background only");
    expect(scenePrompt).toContain("no characters");
    expect(scenePrompt).toContain("no animals");
    expect(scenePrompt).not.toContain("小马");
    expect(scenePrompt).toContain("河边");
    expect(scenePrompt).toContain("适合角色后续放置");
  });

  it("does not generate standalone image tasks for story objects", () => {
    const recipe: DirectorRecipe = {
      intent: "story",
      title: "Object story",
      summary: "A story with a key object.",
      fullStory: "A child carries a magic key through the house.",
      agentBriefs: emptyAgentBriefs,
      highlights: [],
      audience: "kids",
      tone: "warm",
      language: "en",
      artStyle: {
        name: "Storybook",
        promptPrefix: "storybook",
        description: "Warm",
        keywords: [],
        imageUrl: null,
        reasoning: null,
        detail: "Warm",
        imagePrompt: "storybook",
      },
      characters: [
        {
          name: "Magic key",
          description: "A recurring key object.",
          promptText: "Magic key, brass texture, ornate shape",
          type: "object",
          gender: "unknown",
          voiceId: null,
          voice: null,
          imageUrl: null,
        },
      ],
      locations: [],
      scenes: [
        { title: "One", desc: null, script: "One", visualPrompt: "One", audioPrompt: "One", duration: 5, shots: [] },
        { title: "Two", desc: null, script: "Two", visualPrompt: "Two", audioPrompt: "Two", duration: 5, shots: [] },
        { title: "Three", desc: null, script: "Three", visualPrompt: "Three", audioPrompt: "Three", duration: 5, shots: [] },
      ],
      bgm: {
        createMusicParams: {
          tags: ["warm"],
          title: "warm",
          promptText: "   ",
          makeInstrumental: true,
          duration: 30,
        },
        reasoning: null,
        style: "warm",
        prompt: "warm",
      },
      media: { shots: [] },
      mediaPlan: [],
    };

    expect(planPlanningSubjectTasks(recipe)).toEqual([]);
  });

  it("uses storyboard agent shots without local expansion", () => {
    const recipe: DirectorRecipe = {
      intent: "story",
      title: "Shot based story",
      summary: "Shot based story summary.",
      fullStory: "First beat. Second beat. Third beat.",
      agentBriefs: emptyAgentBriefs,
      highlights: [
        { title: "Hook", body: "Clear opening hook." },
        { title: "Turn", body: "Clear turning point." },
        { title: "Payoff", body: "Clear visual payoff." },
      ],
      audience: "kids",
      tone: "warm",
      language: "zh-CN",
      artStyle: {
        name: "Cartoon",
        promptPrefix: "cartoon",
        description: "bright",
        keywords: [],
        imageUrl: null,
        reasoning: null,
        detail: "bright",
        imagePrompt: "cartoon",
      },
      characters: [],
      locations: [],
      scenes: [
        {
          title: "第一幕",
          desc: null,
          script: "第一幕",
          visualPrompt: "第一幕画面",
          audioPrompt: "第一幕声音",
          duration: 9,
          shots: [
            {
              shotId: "s1a",
              title: "建立",
              description: "建立画面",
              characters: [],
              visualElements: "远景",
              dialogue: [{ speaker: "旁白", text: "第一句" }],
            },
            {
              shotId: "s1b",
              title: "推进",
              description: "推进画面",
              characters: [],
              visualElements: "中景",
              dialogue: [{ speaker: "旁白", text: "第二句" }],
            },
          ],
        },
        {
          title: "第二幕",
          desc: null,
          script: "第二幕",
          visualPrompt: "第二幕画面",
          audioPrompt: "第二幕声音",
          duration: 9,
          shots: [
            {
              shotId: "s2a",
              title: "反应",
              description: "反应画面",
              characters: [],
              visualElements: "近景",
              dialogue: [{ speaker: "旁白", text: "第三句" }],
            },
          ],
        },
      ],
      bgm: {
        createMusicParams: {
          tags: ["warm"],
          title: "bgm",
          promptText: "   ",
          makeInstrumental: true,
          duration: 30,
        },
        reasoning: null,
        style: "warm",
        prompt: "warm",
      },
      media: { shots: [] },
      mediaPlan: [],
    };

    expect(buildStoryboardBlocks(recipe)).toEqual([
      expect.objectContaining({
        order: 1,
        title: "第一幕 - 建立",
        script: "第一句",
        visualPrompt: "远景",
      }),
      expect.objectContaining({
        order: 2,
        title: "第一幕 - 推进",
        script: "第二句",
        visualPrompt: "中景",
      }),
      expect.objectContaining({
        order: 3,
        title: "第二幕 - 反应",
        script: "第三句",
        visualPrompt: "近景",
      }),
    ]);
  });

  it("uses the same model storyboard count for creation blocks and media tasks", () => {
    const recipe: DirectorRecipe = {
      intent: "story",
      title: "Single shot scenes",
      summary: "Single shot scenes summary.",
      fullStory: "First scene beat. Second scene beat.",
      agentBriefs: emptyAgentBriefs,
      highlights: [
        { title: "Hook", body: "Clear opening hook." },
        { title: "Turn", body: "Clear turning point." },
        { title: "Payoff", body: "Clear visual payoff." },
      ],
      audience: "kids",
      tone: "warm",
      language: "zh-CN",
      artStyle: {
        name: "Cartoon",
        promptPrefix: "cartoon",
        description: "bright",
        keywords: [],
        imageUrl: "https://cdn.test/style.png",
        reasoning: null,
        detail: "bright",
        imagePrompt: "cartoon",
      },
      characters: [],
      locations: [],
      scenes: [
        {
          title: "第一幕",
          desc: null,
          script: "第一幕台词",
          visualPrompt: "第一幕画面",
          audioPrompt: "第一幕声音",
          duration: 9,
          shots: [
            {
              shotId: "s1a",
              title: "建立",
              description: "建立画面",
              characters: [],
              visualElements: "远景",
              dialogue: [{ speaker: "旁白", text: "第一句" }],
            },
          ],
        },
        {
          title: "第二幕",
          desc: null,
          script: "第二幕台词",
          visualPrompt: "第二幕画面",
          audioPrompt: "第二幕声音",
          duration: 9,
          shots: [
            {
              shotId: "s2a",
              title: "建立",
              description: "第二幕建立",
              characters: [],
              visualElements: "中景",
              dialogue: [{ speaker: "旁白", text: "第二句" }],
            },
          ],
        },
      ],
      bgm: {
        createMusicParams: {
          tags: ["warm"],
          title: "bgm",
          promptText: "   ",
          makeInstrumental: true,
          duration: 30,
        },
        reasoning: null,
        style: "warm",
        prompt: "warm",
      },
      media: {
        shots: [
          {
            shotId: "s1a",
            sceneTitle: "建立",
            imageToImagePromptText: "第一幕图",
            imageToVideoPromptText: "第一幕动",
          },
          {
            shotId: "s2a",
            sceneTitle: "建立",
            imageToImagePromptText: "第二幕图",
            imageToVideoPromptText: "第二幕动",
          },
        ],
      },
      mediaPlan: [],
    };

    const blocks = buildStoryboardBlocks(recipe);

    expect(blocks).toHaveLength(2);
    expect(blocks.map((block) => block.title)).toEqual([
      "第一幕 - 建立",
      "第二幕 - 建立",
    ]);
    expect(
      planCreationPreparationTasks(recipe).map((task) => task.sceneTitle),
    ).toEqual(blocks.map((block) => block.title));
    expect(
      planPlanningSceneImageTasks(recipe)
        .filter((task) => task.tool === "create_location")
        .map((task) => task.sceneTitle),
    ).toEqual(["第一幕", "第二幕"]);
    expect(
      planPlanningAudioTasks(recipe).map((task) => task.sceneTitle),
    ).toEqual([...blocks.map((block) => block.title), "背景音乐"]);
  });

  it("injects aspectRatio from directorBrief into recipe for runner tasks", () => {
    const recipe: DirectorRecipe = {
      intent: "story",
      title: "Test",
      summary: "S",
      fullStory: "F",
      agentBriefs: emptyAgentBriefs,
      highlights: [],
      audience: "kids",
      tone: "warm",
      language: "zh-CN",
      artStyle: { name: "Cartoon", promptPrefix: "cartoon", description: "bright", keywords: [], imageUrl: null, reasoning: null, detail: "bright", imagePrompt: "cartoon" },
      characters: [
        { name: "小马", description: "A pony", promptText: "brave pony", type: "character", gender: "unknown", voiceId: "Calm_Woman", voice: "Warm", imageUrl: null },
      ],
      locations: [],
      scenes: [
        { title: "S1", desc: null, script: "S1", visualPrompt: "S1", audioPrompt: "S1", duration: 5, shots: [] },
        { title: "S2", desc: null, script: "S2", visualPrompt: "S2", audioPrompt: "S2", duration: 5, shots: [] },
        { title: "S3", desc: null, script: "S3", visualPrompt: "S3", audioPrompt: "S3", duration: 5, shots: [] },
      ],
      bgm: { createMusicParams: { tags: ["warm"], title: "bgm", promptText: "   ", makeInstrumental: true, duration: 30 }, reasoning: null, style: "warm", prompt: "warm" },
      media: { shots: [] },
      mediaPlan: [],
    };

    // Without aspectRatio: defaults to 16:9
    const tasksDefault = planRunnerTasks(recipe);
    expect(tasksDefault.filter((t) => t.aspectRatio).every((t) => t.aspectRatio === "16:9")).toBe(true);

    // With aspectRatio on recipe (as blockPlannerNode would inject)
    const recipeWithRatio = { ...recipe, aspectRatio: "9:16" as const };
    const tasks916 = planRunnerTasks(recipeWithRatio);
    const imageTasks = tasks916.filter((t) => ["create_character", "create_location", "image_to_image"].includes(t.tool));
    expect(imageTasks.length).toBeGreaterThan(0);
    expect(imageTasks.every((t) => t.aspectRatio === "9:16")).toBe(true);

    // With 1:1
    const recipe11 = { ...recipe, aspectRatio: "1:1" as const };
    const tasks11 = planRunnerTasks(recipe11);
    const imageTasks11 = tasks11.filter((t) => ["create_character", "create_location", "image_to_image"].includes(t.tool));
    expect(imageTasks11.every((t) => t.aspectRatio === "1:1")).toBe(true);
  });
});
