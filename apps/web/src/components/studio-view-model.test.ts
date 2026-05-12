import { describe, expect, it } from "vitest";
import { buildCreationActionState, buildCreationPreparationSteps, buildPlanningDocumentV2, buildPlanningSections, buildWorkflowActivity, creationActionLabel, createVideoCommand, hasCreationImageAssets, isCreateVideoCommand } from "./studio-view-model";
import type { TranslationFn } from "./studio-view-model";

const zhCN: Record<string, string> = {
  "workflow.directorBrief": "Director Brief",
  "workflow.directorBriefDetail": "已确定故事概念，聚焦于「{title}」。",
  "workflow.directorBriefPending": "正在梳理创作目标和基础约束。",
  "workflow.storyOutline": "故事梗概",
  "workflow.storyOutlineDetail": "正在形成《{title}》的故事结构。",
  "workflow.storyOutlinePending": "等待生成完整故事梗概。",
  "workflow.subjects": "角色",
  "workflow.subjectsDetail": "已规划 {characterCount} 个角色。",
  "workflow.subjectsPending": "等待角色设定。",
  "workflow.artStyle": "美术风格",
  "workflow.artStyleDetail": "视觉风格为 {styleName}。",
  "workflow.artStylePending": "等待美术风格。",
  "workflow.scenes": "场景",
  "workflow.scenesDetail": "已拆分 {sceneCount} 个场景。",
  "workflow.scenesPending": "等待场景列表。",
  "workflow.storyboard": "分镜",
  "workflow.storyboardDetail": "已准备 {shotCount} 个分镜和 {taskCount} 个媒体任务。",
  "workflow.storyboardPending": "等待分镜和执行任务。",
  "workflow.mediaGeneration": "媒体生成",
  "workflow.mediaGenerationDetail": "已准备 {readyCount}/{taskCount} 个角色图、场景图、分镜图、配音或背景音乐任务。",
  "workflow.mediaGenerationTasks": "等待生成 {taskCount} 个角色图、场景图、分镜图、配音或背景音乐任务。",
  "workflow.mediaGenerationRunning": "正在生成：{tasks}。",
  "workflow.mediaGenerationPreparing": "正在准备媒体提示词...",
  "workflow.mediaGenerationPending": "等待媒体任务准备完成。",
  "planning.storyPlan": "Story Plan",
  "planning.story": "story",
  "planning.auto": "auto",
  "planning.audience": "Audience",
  "planning.tone": "Tone",
  "planning.visualStyle": "Visual style",
  "planning.scene": "Scene",
  "planning.visual": "Visual",
  "planning.bgm": "Background music",
  "planning.untitledStory": "未命名故事",
  "planning.waitingInput": "等待创作输入",
  "planning.document": "策划文档",
  "planning.documentDesc": "输入想法后，这里会生成故事梗概、美术风格、角色列表、场景列表和分镜剧本。",
  "planning.aiGenerated": "内容由 AI 生成",
  "planning.hasRecipe": "已有策划",
  "planning.recipeComponents": "Recipe components",
  "planning.runnerTasks": "Runner tasks",
  "planning.generatedMedia": "Generated media",
  "sections.storyOutline": "故事梗概",
  "sections.artStyle": "美术风格",
  "sections.subjectList": "角色列表",
  "sections.sceneList": "场景列表",
  "sections.storyboard": "分镜剧本",
  "sections.mediaRecipe": "媒体生成配方",
  "sections.bgmRecipe": "背景音乐配方",
  "sections.generateAssets": "生成素材",
  "sections.waitingStory": "等待故事梗概",
  "sections.waitingStyle": "等待美术风格",
  "sections.waitingSubjects": "等待角色",
  "sections.waitingScenes": "等待场景",
  "sections.waitingStoryboard": "等待分镜",
  "sections.waitingMediaRecipe": "等待媒体配方",
  "sections.waitingBgm": "等待背景音乐",
  "sections.waitingMediaTasks": "等待媒体任务",
  "sections.subject": "角色",
  "sections.scenePlaceholder": "场景",
  "sections.shot": "镜头",
  "sections.shotMedia": "镜头媒体",
  "sections.stylePrefix": "风格前缀",
  "sections.voice": "声音",
  "sections.image": "图片",
  "sections.video": "视频",
  "sections.type": "类型",
  "creation.previewAndExport": "预览并导出",
  "creation.planning": "生成策划中...",
  "creation.prepAnalyze": "解析策划内容",
  "creation.prepAnalyzeDetail": "读取故事、分镜、角色和风格约束。",
  "creation.prepImage": "生成画面素材",
  "creation.prepImageDetail": "创建角色图、源帧和镜头画面。",
  "creation.prepAudio": "生成声音素材",
  "creation.prepAudioDetail": "生成配音和背景音乐。",
  "creation.prepPackage": "整理素材包",
  "creation.prepPackageDetail": "归集素材 URL、镜头顺序和元数据。",
  "creation.prepWrite": "写入编辑器",
  "creation.prepWriteDetail": "保存素材并打开可编辑时间线。",
  "studio.newVideoDirection": "新视频",
};

const t: TranslationFn = (key, values) => {
  let result = zhCN[key] ?? key;
  if (values) {
    for (const [k, v] of Object.entries(values)) {
      result = result.replace(`{${k}}`, String(v));
    }
  }
  return result;
};

describe("studio view model", () => {
  const messages = [
    {
      id: "assistant-1",
      role: "assistant",
      parts: [
        { type: "data-director-brief", data: { title: "Director Brief", project_name: "小马过河的故事" } },
        {
          type: "data-recipe",
          data: {
            title: "小马过河的故事",
            audience: "儿童",
            tone: "温馨",
            artStyle: { name: "卡通插画", promptPrefix: "小马在河边", description: "色彩鲜艳", imageUrl: "https://cdn.test/style.png" },
            characters: [{ name: "小马", description: "勇敢的小马", promptText: "小马角色设定", type: "character", voice: "活泼可爱", voiceSampleUrl: "https://cdn.test/pony-voice.mp3", imageUrl: "https://cdn.test/pony.png" }],
            scenes: [{ title: "小马遇见河流", script: "小马站在河边", visualPrompt: "河水清澈", audioPrompt: "流水声", duration: 15, shots: [{ title: "河边", description: "小马站在河边", visualElements: "河水清澈" }] }],
            bgm: { createMusicParams: { title: "温暖轻快", tags: ["background music", "warm"], duration: 30 } },
            media: { shots: [{ sceneTitle: "小马遇见河流", imageToImagePromptText: "@小马 站在河边", imageToVideoPromptText: "轻微推镜" }] },
          },
        },
        {
          type: "data-runner-tasks",
          data: { tasks: [
            { id: "character-1", sceneTitle: "角色列表", tool: "create_character", prompt: "小马设定" },
            { id: "scene-1", sceneTitle: "小马遇见河流", tool: "create_location", prompt: "河边环境" },
            { id: "shot-1-image", sceneTitle: "小马遇见河流", tool: "image_to_image", prompt: "小马在河边" },
            { id: "voice-1", sceneTitle: "小马遇见河流", tool: "tts_create", prompt: "小马站在河边" },
            { id: "bgm-1", sceneTitle: "背景音乐", tool: "text_to_bgm", prompt: "warm" },

          ] },
        },
      ],
    },
  ];

  it("shows only creator-facing planning sections in the right document", () => {
    const sections = buildPlanningSections(t, messages);
    const titles = sections.map((section) => section.title);

    expect(titles).toEqual(["故事梗概", "美术风格", "角色列表", "场景列表", "分镜剧本"]);
    expect(titles).not.toContain("媒体生成配方");
    expect(titles).not.toContain("背景音乐配方");
    expect(titles).not.toContain("生成素材");
    expect(titles).not.toContain("创作视频");
    expect(titles).not.toContain("素材生成计划");
    expect(sections.at(-1)).toMatchObject({
      title: "分镜剧本",
      status: "completed",
    });
  });

  it("returns display image urls for art style and subject cards", () => {
    const sections = buildPlanningSections(t, messages);
    const artStyle = sections.find((section) => section.title === "美术风格");
    const subjects = sections.find((section) => section.title === "角色列表");

    expect(artStyle?.items[0]).toMatchObject({ imageUrl: "https://cdn.test/style.png" });
    expect(subjects?.items[0]).toMatchObject({ imageUrl: "https://cdn.test/pony.png" });
    expect(subjects?.items[0].meta).not.toContain("https://cdn.test/pony.png");
  });

  it("builds a creator-facing PlanningDocumentV2 matching the reference format", () => {
    const document = buildPlanningDocumentV2(t, messages);

    expect(document.storyOutline).toMatchObject({
      title: "故事梗概",
      contentLabel: "内容梗概",
      content: expect.stringContaining("小马过河的故事"),
      highlightsTitle: "剧本亮点",
    });
    expect(document.storyOutline.highlights.length).toBeGreaterThanOrEqual(1);
    expect(document.subjects[0]).toMatchObject({
      name: "小马",
      description: "勇敢的小马",
      imageUrl: "https://cdn.test/pony.png",
      audioUrl: "https://cdn.test/pony-voice.mp3",
    });
    expect(document.scenes[0]).toMatchObject({
      name: "小马遇见河流",
      description: expect.stringContaining("河水清澈"),
      imageUrl: undefined,
    });
    expect(document.artStyle).toMatchObject({
      title: "美术风格",
      baseLabel: "基础画风风格",
      baseStyle: "卡通插画",
      description: expect.stringContaining("色彩鲜艳"),
      imageUrl: "https://cdn.test/style.png",
    });
    expect(document.storyboard).toMatchObject({
      title: "分镜剧本",
      sceneCount: 1,
      voiceRole: expect.any(String),
    });
    expect(document.storyboard.chapters[0].shots).toHaveLength(1);
    expect(document.storyboard.chapters[0].shots[0]).toMatchObject({
      shotNumber: 1,
      fields: {
        picture: "小马站在河边",
        composition: expect.any(String),
        camera: expect.any(String),
        voiceRole: expect.any(String),
        dialogue: expect.any(String),
        frameType: expect.any(String),
      },
    });
  });

  it("preserves existing shot dialogue without adding local storyboard shots", () => {
    const document = buildPlanningDocumentV2(t, [{
      parts: [{
        type: "data-recipe",
        data: {
          title: "小马过河",
          artStyle: { name: "卡通插画" },
          characters: [],
          scenes: [{
            title: "小马面对河流",
            desc: "小马站在小河边，朋友在旁边鼓励。",
            script: "小马在河边停下，看到水流奔腾，心中充满了紧张与期待。",
            visualPrompt: "小马在小河边。",
            shots: [
              {
                shotId: "shot1",
                title: "小马的犹豫",
                description: "小马观察河流。",
                visualElements: "小马站在河边。",
                dialogue: [{ speaker: "小马", text: "我能否过得去呢？" }],
              },
              {
                shotId: "shot2",
                title: "朋友的鼓励",
                description: "朋友鼓励小马。",
                visualElements: "朋友站在岸边。",
                dialogue: [{ speaker: "小兔子", text: "别害怕，小马，勇敢尝试！" }],
              },
            ],
          }],
        },
      }],
    }]);

    expect(document.storyboard.chapters[0].shots.map((shot) => shot.fields.dialogue)).toEqual([
      "我能否过得去呢？",
      "别害怕，小马，勇敢尝试！",
    ]);
  });

  it("does not duplicate scene list copy for fallback script highlights", () => {
    const document = buildPlanningDocumentV2(t, [{
      parts: [{
        type: "data-recipe",
        data: {
          title: "小马过河",
          artStyle: { name: "卡通" },
          characters: [],
          scenes: [
            { title: "小马看到小河", desc: "小马在森林里遇见了河，河水流淌着，看起来有些可怕。", script: "小马站在河边犹豫。", visualPrompt: "森林里的小河" },
            { title: "小马的冒险", desc: "小马决定寻找过河的方法，沿着河岸探索。", script: "小马沿河岸前进。", visualPrompt: "河岸探索" },
            { title: "小马成功过河", desc: "在勇气和智慧的指引下，小马找到一块石头，成功过了河。", script: "小马踏着石头过河。", visualPrompt: "浅滩石头" },
          ],
        },
      }],
    }]);

    const sceneCopies = new Set(document.scenes.map((scene) => `${scene.name}：${scene.description}`));
    const highlightCopies = document.storyOutline.highlights.map((highlight) => `${highlight.title}：${highlight.body}`);

    expect(document.storyOutline.highlights).toHaveLength(3);
    expect(highlightCopies.every((copy) => !sceneCopies.has(copy))).toBe(true);
  });

  it("uses fullStory as the primary story outline when present", () => {
    const document = buildPlanningDocumentV2(t, [{
      parts: [{
        type: "data-recipe",
        data: {
          title: "小马过河",
          fullStory: "小马第一次遇到河流时很害怕，但它听取朋友建议，最终勇敢过河。",
          summary: "这是摘要。",
          artStyle: { name: "卡通" },
          characters: [],
          scenes: [
            { title: "第一幕", script: "第一幕台词", visualPrompt: "第一幕画面", shots: [{ description: "第一幕镜头", dialogue: [{ speaker: "旁白", text: "第一句" }] }] },
          ],
        },
      }],
    }]);

    expect(document.storyOutline.content).toBe("小马第一次遇到河流时很害怕，但它听取朋友建议，最终勇敢过河。");
  });

  it("exposes playable voice, shot narration, and bgm audio in PlanningDocumentV2", () => {
    const document = buildPlanningDocumentV2(t, [
      {
        parts: [
          messages[0].parts[1],
          {
            type: "data-media-assets",
            data: {
              assets: [
                { taskId: "voice-1", sceneTitle: "小马遇见河流 - 河边", type: "audio", tool: "tts_create", url: "https://cdn.test/shot-voice.mp3" },
                { taskId: "bgm-1", sceneTitle: "背景音乐", type: "audio", tool: "text_to_bgm", url: "https://cdn.test/bgm.mp3" },
              ],
            },
          },
        ],
      },
    ]);

    expect(document.subjects[0]).toMatchObject({ audioUrl: "https://cdn.test/pony-voice.mp3" });
    expect(document.storyboard.voiceAudioUrl).toBe("https://cdn.test/pony-voice.mp3");
    expect(document.storyboard.bgmAudioUrl).toBe("https://cdn.test/bgm.mp3");
    expect(document.storyboard.chapters[0].shots[0]).toMatchObject({
      audioUrl: "https://cdn.test/shot-voice.mp3",
    });
  });

  it("maps storyboard narration audio by shot id when task ids or titles are unavailable", () => {
    const document = buildPlanningDocumentV2(t, [
      {
        parts: [
          {
            type: "data-recipe",
            data: {
              title: "三段台词",
              artStyle: { name: "卡通", description: "明亮" },
              characters: [],
              scenes: [
                {
                  title: "第一幕",
                  script: "完整场景台词",
                  visualPrompt: "画面",
                  shots: [
                    { shotId: "shot-a", title: "开始", description: "开始", visualElements: "开始", dialogue: [{ speaker: "旁白", text: "第一句" }] },
                    { shotId: "shot-b", title: "推进", description: "推进", visualElements: "推进", dialogue: [{ speaker: "旁白", text: "第二句" }] },
                    { shotId: "shot-c", title: "结束", description: "结束", visualElements: "结束", dialogue: [{ speaker: "旁白", text: "第三句" }] },
                  ],
                },
              ],
              bgm: { createMusicParams: { title: "音乐", tags: [], duration: 30 } },
              media: { shots: [] },
            },
          },
          {
            type: "data-media-assets",
            data: {
              assets: [
                { type: "audio", tool: "tts_create", url: "https://cdn.test/a.mp3", metadata: { task: { tool: "tts_create", shotId: "shot-a" } } },
                { type: "audio", tool: "tts_create", url: "https://cdn.test/b.mp3", metadata: { task: { tool: "tts_create", shotId: "shot-b" } } },
                { type: "audio", tool: "tts_create", url: "https://cdn.test/c.mp3", metadata: { task: { tool: "tts_create", shotId: "shot-c" } } },
              ],
            },
          },
        ],
      },
    ]);

    expect(document.storyboard.chapters[0].shots.map((shot) => shot.audioUrl)).toEqual([
      "https://cdn.test/a.mp3",
      "https://cdn.test/b.mp3",
      "https://cdn.test/c.mp3",
    ]);
  });

  it("trusts the type field for subject classification", () => {
    const document = buildPlanningDocumentV2(t, [{
      parts: [{
        type: "data-recipe",
        data: {
          title: "小马过河",
          artStyle: { name: "卡通" },
          characters: [
            { name: "小马", description: "勇敢的小马", promptText: "pony character", type: "character" },
            { name: "河流", description: "一条清澈的河流", promptText: "clear river", type: "object" },
          ],
          scenes: [],
        },
      }],
    }]);

    expect(document.subjects.map((subject) => subject.name)).toEqual(["小马", "河流"]);
  });

  it("uses generated scene image assets in PlanningDocumentV2 scene cards", () => {
    const document = buildPlanningDocumentV2(t, [
      {
        parts: [
          {
            type: "data-recipe",
            data: {
              title: "办公室故事",
              artStyle: { name: "3D" },
              characters: [],
              scenes: [
                { title: "明亮悠闲办公区", script: "办公室阳光充足", visualPrompt: "温暖办公室" },
                { title: "阴暗压抑办公区", script: "灯光昏暗", visualPrompt: "冷色办公室" },
              ],
            },
          },
          {
            type: "data-media-assets",
            data: {
              assets: [
                { sceneTitle: "明亮悠闲办公区", type: "image", tool: "image_to_image", url: "https://cdn.test/bright-office.png" },
                { sceneTitle: "阴暗压抑办公区", type: "image", tool: "create_location", url: "https://cdn.test/dark-office.png" },
              ],
            },
          },
        ],
      },
    ]);

    expect(document.scenes).toEqual([
      expect.objectContaining({ name: "明亮悠闲办公区", imageUrl: "https://cdn.test/bright-office.png" }),
      expect.objectContaining({ name: "阴暗压抑办公区", imageUrl: "https://cdn.test/dark-office.png" }),
    ]);
  });

  it("marks subject and scene cards as loading while image tasks are pending", () => {
    const document = buildPlanningDocumentV2(t, [
      {
        parts: [
          {
            type: "data-recipe",
            data: {
              title: "小马过河",
              artStyle: { name: "卡通" },
              characters: [
                { name: "小马", description: "勇敢的小马", promptText: "pony character", type: "character" },
                { name: "老牛", description: "稳重的老牛", promptText: "old ox character", type: "character", imageUrl: "https://cdn.test/ox.png" },
              ],
              scenes: [
                { title: "小马在河边", script: "小马来到河边", visualPrompt: "河边空景" },
                { title: "草地小路", script: "草地上的小路", visualPrompt: "草地小路", imageUrl: "https://cdn.test/path.png" },
              ],
            },
          },
          {
            type: "data-runner-tasks",
            data: {
              tasks: [
                { id: "character-1", sceneTitle: "角色列表", tool: "create_character" },
                { id: "scene-1-image", sceneTitle: "小马在河边", tool: "create_location" },
              ],
            },
          },
        ],
      },
    ]);

    expect(document.subjects).toEqual([
      expect.objectContaining({ name: "小马", imageUrl: undefined, loading: true }),
      expect.objectContaining({ name: "老牛", imageUrl: "https://cdn.test/ox.png", loading: false }),
    ]);
    expect(document.scenes).toEqual([
      expect.objectContaining({ name: "小马在河边", imageUrl: undefined, loading: true }),
      expect.objectContaining({ name: "草地小路", imageUrl: "https://cdn.test/path.png", loading: false }),
    ]);
  });

  it("keeps subject and scene image placeholders while planning is still streaming before media tasks arrive", () => {
    const document = buildPlanningDocumentV2(t, [
      {
        parts: [
          {
            type: "data-agent-status",
            data: { node: "recipe_generator", status: "running" },
          },
          {
            type: "data-recipe",
            data: {
              title: "小马过河",
              artStyle: { name: "卡通" },
              characters: [
                { name: "小马", description: "勇敢的小马", promptText: "pony character", type: "character" },
              ],
              scenes: [
                { title: "小马在河边", script: "小马来到河边", visualPrompt: "河边空景", shots: [{ title: "建立", description: "小马站在河边" }] },
              ],
            },
          },
        ],
      },
    ]);

    expect(document.subjects).toEqual([
      expect.objectContaining({ name: "小马", imageUrl: undefined, loading: true }),
    ]);
    expect(document.scenes).toEqual([
      expect.objectContaining({ name: "小马在河边", imageUrl: undefined, loading: true }),
    ]);
  });

  it("keeps planning scene images when later audio assets stream in", () => {
    const document = buildPlanningDocumentV2(t, [
      {
        parts: [
          {
            type: "data-recipe",
            data: {
              title: "小马过河",
              artStyle: { name: "卡通" },
              characters: [],
              scenes: [
                { title: "草船的准备", script: "诸葛亮准备草船", visualPrompt: "江边草船" },
              ],
            },
          },
          {
            type: "data-media-assets",
            data: {
              assets: [
                {
                  sceneTitle: "草船的准备 - 建立",
                  type: "image",
                  tool: "image_to_image",
                  url: "https://cdn.test/scene.png",
                },
              ],
            },
          },
          {
            type: "data-media-assets",
            data: {
              assets: [
                {
                  sceneTitle: "草船的准备 - 建立",
                  type: "audio",
                  tool: "tts_create",
                  url: "https://cdn.test/voice.mp3",
                },
              ],
            },
          },
        ],
      },
    ]);

    expect(document.scenes[0]).toMatchObject({
      name: "草船的准备",
      imageUrl: "https://cdn.test/scene.png",
    });
  });

  it("marks waiting PlanningDocumentV2 sections as loading", () => {
    const document = buildPlanningDocumentV2(t, [{
      parts: [
        {
          type: "data-recipe",
          data: {
            title: "生成中的故事",
          },
        },
      ],
    }]);

    expect(document.subjects[0]).toMatchObject({ loading: true });
    expect(document.scenes[0]).toMatchObject({ loading: true });
    expect(document.artStyle.loading).toBe(true);
    expect(document.storyboard.loading).toBe(true);
  });

  it("numbers storyboard shots globally across chapters", () => {
    const document = buildPlanningDocumentV2(t, [{
      parts: [{
        type: "data-recipe",
        data: {
          title: "两幕故事",
          artStyle: { name: "卡通" },
          characters: [],
          scenes: [
            { title: "第一幕", script: "第一幕台词", visualPrompt: "第一幕画面", shots: [{ description: "第一幕镜头" }] },
            { title: "第二幕", script: "第二幕台词", visualPrompt: "第二幕画面", shots: [{ description: "第二幕镜头" }] },
          ],
        },
      }],
    }]);

    expect(document.storyboard.chapters[0].shots.map((shot) => shot.shotNumber)).toEqual([1]);
    expect(document.storyboard.chapters[1].shots.map((shot) => shot.shotNumber)).toEqual([2]);
  });

  it("summarizes streamed workflow activity for the left panel", () => {
    expect(buildWorkflowActivity(messages, "streaming", t)).toEqual([
      expect.objectContaining({ title: "Director Brief", status: "completed", detail: expect.stringContaining("小马过河的故事") }),
      expect.objectContaining({ title: "故事梗概", status: "completed", detail: expect.stringContaining("小马过河的故事") }),
      expect.objectContaining({ title: "角色", status: "completed", detail: expect.stringContaining("1 个角色") }),
      expect.objectContaining({ title: "美术风格", status: "completed", detail: expect.stringContaining("卡通插画") }),
      expect.objectContaining({ title: "场景", status: "completed", detail: expect.stringContaining("1 个场景") }),
      expect.objectContaining({ title: "分镜", status: "completed", detail: expect.stringContaining("1 个分镜") }),
      expect.objectContaining({ title: "媒体生成", status: "running", detail: "正在生成：角色图「角色列表」、场景图「小马遇见河流」、分镜图「小马遇见河流」、配音「小马遇见河流」。" }),
    ]);
  });

  it("counts model storyboard shots in workflow activity", () => {
    const activity = buildWorkflowActivity([
      {
        parts: [
          {
            type: "data-recipe",
            data: {
              title: "三幕故事",
              artStyle: { name: "卡通" },
              characters: [],
              scenes: [
                { title: "第一幕", script: "第一幕", visualPrompt: "第一幕", duration: 9, shots: [{ title: "建立", description: "建立", visualElements: "画面", dialogue: [] }] },
                { title: "第二幕", script: "第二幕", visualPrompt: "第二幕", duration: 9, shots: [{ title: "推进", description: "推进", visualElements: "画面", dialogue: [] }] },
              ],
            },
          },
        ],
      },
    ], "ready", t);

    expect(activity.find((item) => item.title === "分镜")?.detail).toContain("2 个分镜");
  });

  it("counts planning media assets without counting video tasks", () => {
    const activity = buildWorkflowActivity([
      {
        parts: [
          messages[0].parts[0],
          messages[0].parts[1],
          messages[0].parts[2],
          {
            type: "data-media-assets",
            data: {
              assets: [
                { sceneTitle: "角色列表", type: "image", tool: "create_character", url: "https://cdn.test/subject.png" },
                { sceneTitle: "小马遇见河流", type: "image", tool: "create_location", url: "https://cdn.test/scene.png" },
                { sceneTitle: "小马遇见河流", type: "image", tool: "image_to_image", url: "https://cdn.test/storyboard.png" },
                { sceneTitle: "小马遇见河流", type: "audio", tool: "tts_create", url: "https://cdn.test/voice.mp3" },
                { sceneTitle: "背景音乐", type: "audio", tool: "text_to_bgm", url: "https://cdn.test/bgm.mp3" },
              ],
            },
          },
        ],
      },
    ], "ready", t);

    expect(activity.at(-1)).toMatchObject({
      title: "媒体生成",
      status: "completed",
      detail: "已准备 5/5 个角色图、场景图、分镜图、配音或背景音乐任务。",
    });
  });

  it("shows currently running media task names in workflow activity", () => {
    const activity = buildWorkflowActivity([
      {
        parts: [
          messages[0].parts[1],
          messages[0].parts[2],
          {
            type: "data-runner-progress",
            data: {
              running: [
                { id: "scene-1-image", tool: "create_location", sceneTitle: "小马遇到河流" },
                { id: "shot-4-image", tool: "image_to_image", sceneTitle: "成功过河" },
                { id: "voice-2", tool: "tts_create", sceneTitle: "小马请教老牛" },
              ],
              completedCount: 2,
              taskCount: 5,
            },
          },
        ],
      },
    ], "streaming", t);

    expect(activity.at(-1)).toMatchObject({
      title: "媒体生成",
      status: "running",
      detail: "正在生成：场景图「小马遇到河流」、分镜图「成功过河」、配音「小马请教老牛」。",
    });
  });

  it("shows pending media task names while streaming before runner progress arrives", () => {
    const activity = buildWorkflowActivity([
      {
        parts: [
          messages[0].parts[1],
          messages[0].parts[2],
        ],
      },
    ], "streaming", t);

    expect(activity.at(-1)).toMatchObject({
      title: "媒体生成",
      status: "running",
      detail: "正在生成：角色图「角色列表」、场景图「小马遇见河流」、分镜图「小马遇见河流」、配音「小马遇见河流」。",
    });
  });

  it("keeps director brief running while the brief is awaiting confirmation", () => {
    const pendingBriefMessages = [
      {
        id: "assistant-brief",
        role: "assistant",
        parts: [
          { type: "data-agent-status", data: { node: "director_node", status: "completed", next: "recipe_generator" } },
          { type: "data-director-brief", data: { title: "Director Brief", project_name: "恐怖故事" } },
        ],
      },
    ];

    expect(buildWorkflowActivity(pendingBriefMessages, "ready", t)).toEqual([
      expect.objectContaining({ title: "Director Brief", status: "running", detail: expect.stringContaining("恐怖故事") }),
      expect.objectContaining({ title: "故事梗概", status: "pending" }),
      expect.objectContaining({ title: "角色", status: "pending" }),
      expect.objectContaining({ title: "美术风格", status: "pending" }),
      expect.objectContaining({ title: "场景", status: "pending" }),
      expect.objectContaining({ title: "分镜", status: "pending" }),
      expect.objectContaining({ title: "媒体生成", status: "pending" }),
    ]);
  });

  it("moves the spinner to story outline after brief confirmation starts recipe generation", () => {
    const generatingRecipeMessages = [
      {
        id: "assistant-recipe",
        role: "assistant",
        parts: [
          { type: "data-director-brief", data: { title: "Director Brief", project_name: "恐怖故事" } },
          { type: "data-agent-status", data: { node: "recipe_generator", status: "running" } },
        ],
      },
    ];

    expect(buildWorkflowActivity(generatingRecipeMessages, "streaming", t)).toEqual([
      expect.objectContaining({ title: "Director Brief", status: "completed" }),
      expect.objectContaining({ title: "故事梗概", status: "running" }),
      expect.objectContaining({ title: "角色", status: "pending" }),
      expect.objectContaining({ title: "美术风格", status: "pending" }),
      expect.objectContaining({ title: "场景", status: "pending" }),
      expect.objectContaining({ title: "分镜", status: "pending" }),
      expect.objectContaining({ title: "媒体生成", status: "pending" }),
    ]);
  });

  it("uses an explicit command to start media generation", () => {
    expect(createVideoCommand()).toBe("创作视频");
    expect(isCreateVideoCommand("创作视频")).toBe(true);
    expect(isCreateVideoCommand("  create video  ")).toBe(true);
    expect(isCreateVideoCommand("我想做小马过河")).toBe(false);
  });

  it("switches the creation action once image-to-image editor assets exist", () => {
    expect(hasCreationImageAssets([])).toBe(false);
    expect(creationActionLabel(t, false)).toBe("预览并导出");
    expect(hasCreationImageAssets([{ type: "IMAGE", metadata: { task: { tool: "image_to_image" } } }])).toBe(true);
    expect(creationActionLabel(t, true)).toBe("预览并导出");
  });

  it("disables create video while planning is streaming or not ready", () => {
    expect(buildCreationActionState(t, {
      chatStatus: "streaming",
      creationReady: false,
      creationBusy: false,
      hasRecipe: true,
      hasRunnerTasks: true,
    })).toEqual({
      disabled: true,
      loading: true,
      label: "生成策划中...",
    });

    expect(buildCreationActionState(t, {
      chatStatus: "ready",
      creationReady: false,
      creationBusy: false,
      hasRecipe: true,
      hasRunnerTasks: false,
    })).toEqual({
      disabled: true,
      loading: false,
      label: "预览并导出",
    });

    expect(buildCreationActionState(t, {
      chatStatus: "ready",
      creationReady: false,
      creationBusy: false,
      hasRecipe: true,
      hasRunnerTasks: true,
    })).toEqual({
      disabled: false,
      loading: false,
      label: "预览并导出",
    });
  });

  it("builds per-step progress for creation preparation", () => {
    const steps = buildCreationPreparationSteps(t, 9);

    expect(steps).toEqual([
      expect.objectContaining({ title: "解析策划内容", status: "completed", progress: 100 }),
      expect.objectContaining({ title: "生成画面素材", status: "completed", progress: 100 }),
      expect.objectContaining({ title: "生成声音素材", status: "running", progress: 50 }),
      expect.objectContaining({ title: "整理素材包", status: "pending", progress: 0 }),
      expect.objectContaining({ title: "写入编辑器", status: "pending", progress: 0 }),
    ]);
  });
});
