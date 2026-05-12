import { filterReusableVisualSubjects } from "@/lib/planning-subjects";

type MessagePart = {
  type: string;
  text?: string;
  data?: unknown;
};

type StudioMessage = {
  parts?: MessagePart[];
};

export type WorkflowStatus = "pending" | "running" | "completed" | "failed";

export type WorkflowActivity = {
  title: string;
  detail: string;
  status: WorkflowStatus;
};

export type CreationPreparationStep = WorkflowActivity & {
  progress: number;
};

export type PlanningSection = {
  title: string;
  status: WorkflowStatus | "ready";
  items: Array<{ title: string; body: string; meta?: string; imageUrl?: string; audioUrl?: string }>;
  actionLabel?: string;
};

export type PlanningDocumentV2 = {
  storyOutline: {
    title: string;
    contentLabel: string;
    content: string;
    highlightsTitle: string;
    highlights: Array<{ title: string; body: string }>;
  };
  subjects: Array<{ name: string; description: string; imageUrl?: string; audioUrl?: string; loading?: boolean }>;
  scenes: Array<{ name: string; description: string; imageUrl?: string; loading?: boolean }>;
  artStyle: {
    title: string;
    baseLabel: string;
    baseStyle: string;
    description: string;
    imageUrl?: string;
    loading?: boolean;
  };
  storyboard: {
    title: string;
    sceneCount: number;
    voiceRole: string;
    voiceAudioUrl?: string;
    bgmAudioUrl?: string;
    loading?: boolean;
    chapters: Array<{
      title: string;
      meta: string;
      shots: Array<{
        shotNumber: number;
        audioUrl?: string;
        fields: {
          picture: string;
          composition: string;
          camera: string;
          voiceRole: string;
          dialogue: string;
          frameType: string;
        };
      }>;
    }>;
  };
  mediaAssets: {
    title: string;
    images: Array<{ assetId: string; url: string; sceneTitle: string; shotId?: string; prompt?: string }>;
    audio: Array<{ assetId: string; url: string; sceneTitle: string; shotId?: string; tool: string }>;
  };
};

export type TranslationFn = (key: string, values?: any) => string;

export type CreationAssetLike = {
  type?: unknown;
  metadata?: unknown;
};

export type CreationActionState = {
  label: string;
  disabled: boolean;
  loading: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function imageValue(record: Record<string, unknown>) {
  return textValue(record.imageUrl, textValue(record.image_url, textValue(record.image)));
}

function audioValue(record: Record<string, unknown>) {
  return textValue(
    record.audioUrl,
    textValue(
      record.audio_url,
      textValue(record.voiceSampleUrl, textValue(record.voice_sample, textValue(record.voiceSample))),
    ),
  );
}

function isGeneratedSceneImageAsset(asset: Record<string, unknown>) {
  const metadata = asRecord(asset.metadata);
  const task = asRecord(metadata.task);
  const type = textValue(asset.type).toLowerCase();
  const tool = textValue(asset.tool, textValue(task.tool));
  return type === "image" && (tool === "image_to_image" || tool === "create_location");
}

function isGeneratedAudioAsset(asset: Record<string, unknown>, tool: string) {
  const metadata = asRecord(asset.metadata);
  const task = asRecord(metadata.task);
  const type = textValue(asset.type).toLowerCase();
  return type === "audio" && textValue(asset.tool, textValue(task.tool)) === tool;
}

function dataParts(messages: StudioMessage[], type: string) {
  return messages.flatMap((message) => (message.parts ?? []).filter((part) => part.type === type).map((part) => asRecord(part.data)));
}

function sceneTitleCandidates(title: string) {
  const trimmed = title.trim();
  const separatorIndex = trimmed.indexOf(" - ");
  return separatorIndex > 0 ? [trimmed, trimmed.slice(0, separatorIndex)] : [trimmed];
}

function generatedSceneImageMap(messages: StudioMessage[]) {
  const bySceneTitle = new Map<string, string>();
  for (const mediaAssets of dataParts(messages, "data-media-assets")) {
    for (const asset of arrayRecords(mediaAssets.assets)) {
      if (!isGeneratedSceneImageAsset(asset)) continue;
      const sceneTitle = textValue(asset.sceneTitle);
      const url = textValue(asset.url);
      if (!sceneTitle || !url) continue;
      for (const candidate of sceneTitleCandidates(sceneTitle)) {
        if (candidate && !bySceneTitle.has(candidate)) {
          bySceneTitle.set(candidate, url);
        }
      }
    }
  }
  return bySceneTitle;
}

function generatedSubjectImageMap(messages: StudioMessage[]) {
  const byIndex = new Map<number, string>();
  for (const mediaAssets of dataParts(messages, "data-media-assets")) {
    for (const asset of arrayRecords(mediaAssets.assets)) {
      const metadata = asRecord(asset.metadata);
      const task = asRecord(metadata.task);
      const type = textValue(asset.type).toLowerCase();
      const tool = textValue(asset.tool, textValue(task.tool));
      if (type !== "image" || tool !== "create_character") continue;
      const url = textValue(asset.url);
      if (!url) continue;
      const taskId = textValue(asset.taskId, textValue(task.id));
      const match = taskId.match(/^character-(\d+)$/);
      if (match) {
        const index = parseInt(match[1], 10) - 1;
        if (index >= 0 && !byIndex.has(index)) byIndex.set(index, url);
      }
    }
  }
  return byIndex;
}

function generatedShotAudioMap(messages: StudioMessage[]) {
  const byTaskId = new Map<string, string>();
  const byShotId = new Map<string, string>();
  const bySceneTitle = new Map<string, string>();
  for (const mediaAssets of dataParts(messages, "data-media-assets")) {
    for (const asset of arrayRecords(mediaAssets.assets)) {
      if (!isGeneratedAudioAsset(asset, "tts_create")) continue;
      const url = textValue(asset.url);
      if (!url) continue;
      const taskId = textValue(asset.taskId, textValue(asRecord(asRecord(asset.metadata).task).id));
      const shotId = textValue(asset.shotId, textValue(asRecord(asRecord(asset.metadata).task).shotId));
      const sceneTitle = textValue(asset.sceneTitle, textValue(asRecord(asRecord(asset.metadata).task).sceneTitle));
      if (taskId) byTaskId.set(taskId, url);
      if (shotId) byShotId.set(shotId, url);
      if (sceneTitle) bySceneTitle.set(sceneTitle, url);
    }
  }
  return { byTaskId, byShotId, bySceneTitle };
}

function generatedBgmAudioUrl(messages: StudioMessage[]) {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const parts = messages[messageIndex].parts ?? [];
    for (let partIndex = parts.length - 1; partIndex >= 0; partIndex -= 1) {
      const part = parts[partIndex];
      if (part.type !== "data-media-assets") continue;
      for (const asset of arrayRecords(asRecord(part.data).assets)) {
        if (isGeneratedAudioAsset(asset, "text_to_bgm")) return textValue(asset.url) || undefined;
      }
    }
  }
  return undefined;
}

function latestRunnerTasks(messages: StudioMessage[]) {
  return arrayRecords(latestDataPart(messages, "data-runner-tasks").tasks);
}

function hasPendingSubjectImageTask(tasks: Record<string, unknown>[], index: number) {
  const expectedId = `character-${index + 1}`;
  return tasks.some((task) =>
    taskTool(task) === "create_character" &&
    (textValue(task.id) === expectedId || textValue(task.sceneTitle) === "角色列表"),
  );
}

function hasPendingSceneImageTask(tasks: Record<string, unknown>[], scene: Record<string, unknown>, index: number) {
  const expectedId = `scene-${index + 1}-image`;
  const legacyExpectedId = `scene-${index + 1}`;
  const sceneTitle = textValue(scene.title);
  return tasks.some((task) =>
    taskTool(task) === "create_location" &&
    (
      textValue(task.id) === expectedId ||
      textValue(task.id) === legacyExpectedId ||
      textValue(task.sceneTitle) === sceneTitle
    ),
  );
}

function arrayRecords(value: unknown) {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = textValue(value).trim();
    if (text) return text;
  }
  return "";
}

function fieldValue(record: Record<string, unknown>, keys: string[], fallback = "") {
  return firstText(...keys.map((key) => record[key])) || fallback;
}

function dialogueText(shot: Record<string, unknown>, scene: Record<string, unknown>) {
  const direct = fieldValue(shot, ["dialogueText", "dialogue_text", "line", "voiceover", "ttsText"]);
  if (direct) return direct;
  const dialogue = arrayRecords(shot.dialogue)
    .map((line) => textValue(line.text))
    .filter(Boolean)
    .join(" ");
  return dialogue || textValue(scene.script) || "无台词。";
}

function speakerText(shot: Record<string, unknown>, scene: Record<string, unknown>) {
  const direct = fieldValue(shot, ["voiceRole", "voice_role", "speaker", "voice"]);
  if (direct) return direct;
  const firstDialogue = arrayRecords(shot.dialogue)[0];
  return textValue(firstDialogue?.speaker, textValue(scene.audioPrompt, "旁白"));
}

function storyboardShotFields(shot: Record<string, unknown>, scene: Record<string, unknown>) {
  const visualElements = textValue(shot.visualElements);
  const description = textValue(shot.description, textValue(scene.script));
  return {
    picture: fieldValue(shot, ["picture", "pictureDescription", "description"], description),
    composition: fieldValue(shot, ["composition", "compositionDesign", "framing"], visualElements ? `围绕「${visualElements}」组织画面层次。` : "中景，平视。"),
    camera: fieldValue(shot, ["camera", "cameraMovement", "movement"], "固定镜头"),
    voiceRole: speakerText(shot, scene),
    dialogue: dialogueText(shot, scene),
    frameType: fieldValue(shot, ["frameType", "shotType", "type"], "普通画面"),
  };
}

function expandStoryboardShots(scene: Record<string, unknown>, shots: Record<string, unknown>[]) {
  if (shots.length) return shots;
  const baseShot = shots[0] ?? {};
  const sceneTitle = textValue(scene.title, "当前场景");
  const sceneVisual = firstText(scene.visualPrompt, baseShot.visualElements, scene.desc, scene.script, sceneTitle);
  const sceneScript = textValue(scene.script, dialogueText(baseShot, scene));
  const voiceRole = speakerText(baseShot, scene);
  return [{
    ...baseShot,
    title: fieldValue(baseShot, ["title"], `${sceneTitle}建立镜头`),
    description: fieldValue(baseShot, ["description"], `${sceneTitle}的环境与角色状态被清晰建立。`),
    visualElements: fieldValue(baseShot, ["visualElements"], sceneVisual),
    composition: fieldValue(baseShot, ["composition", "compositionDesign", "framing"], "中景，平视，先交代人物与空间关系。"),
    camera: fieldValue(baseShot, ["camera", "cameraMovement", "movement"], "固定镜头"),
    frameType: fieldValue(baseShot, ["frameType", "shotType", "type"], "普通画面"),
    dialogue: arrayRecords(baseShot.dialogue).length ? baseShot.dialogue : [{ speaker: voiceRole, text: sceneScript }],
  }];
}

function storyContent(recipe: Record<string, unknown>, scenes: Record<string, unknown>[]) {
  const explicit = fieldValue(recipe, ["fullStory", "full_story", "summary", "storySummary", "outline", "content"]);
  if (explicit) return explicit;
  const sceneScripts = scenes.map((scene) => textValue(scene.script)).filter(Boolean).join(" ");
  const title = textValue(recipe.title, "未命名故事");
  return sceneScripts ? `${title}：${sceneScripts}` : `${title}：围绕核心角色和关键情境展开，逐步完成冲突、选择与结果的完整表达。`;
}

function storyHighlights(recipe: Record<string, unknown>, scenes: Record<string, unknown>[]) {
  const explicit = arrayRecords(recipe.highlights).map((item, index) => ({
    title: textValue(item.title, `亮点${index + 1}`),
    body: textValue(item.body, textValue(item.description)),
  })).filter((item) => item.title || item.body);
  if (explicit.length) return explicit;

  const highlightFrames = [
    {
      title: "亮点1：开场冲突快速成立",
      body: "用第一个关键情境立刻交代角色目标与阻碍，让观众在开篇就理解故事为什么必须继续推进。",
    },
    {
      title: "亮点2：角色选择带动情绪转折",
      body: "中段不只罗列行动，而是突出角色在犹豫、试探或判断中的变化，让剧情有明确的心理推进。",
    },
    {
      title: "亮点3：结果具有可视化记忆点",
      body: "结尾把行动结果转化成清晰画面和情绪落点，便于后续分镜形成有辨识度的收束镜头。",
    },
  ];
  const fromScenes = highlightFrames.map((frame, index) => {
    const scene = scenes[index];
    const sceneClue = scene ? firstText(scene.script, scene.desc, scene.visualPrompt) : "";
    return {
      title: frame.title,
      body: sceneClue ? `${frame.body} 参考剧情线索：${sceneClue}` : frame.body,
    };
  });
  return fromScenes.length ? fromScenes : [{
    title: "亮点1：核心冲突清晰",
    body: "通过明确的角色目标、阻碍和结果，形成便于分镜展开的故事推进。",
  }];
}

export function buildPlanningDocumentV2(t: TranslationFn, messages?: StudioMessage[]): PlanningDocumentV2 {
  const recipe = latestDataPart(messages ?? [], "data-recipe");
  const artStyle = asRecord(recipe.artStyle);
  const characters = filterReusableVisualSubjects(arrayRecords(recipe.characters));
  const scenes = arrayRecords(recipe.scenes);
  const runnerTasks = latestRunnerTasks(messages ?? []);
  const sceneImageByTitle = generatedSceneImageMap(messages ?? []);
  const subjectImageByIndex = generatedSubjectImageMap(messages ?? []);
  const shotAudio = generatedShotAudioMap(messages ?? []);
  const bgmAudioUrl = generatedBgmAudioUrl(messages ?? []);
  const title = textValue(recipe.title, t("planning.untitledStory"));
  const waitingSubjects = characters.length === 0;
  const waitingScenes = scenes.length === 0;
  const waitingArtStyle = !textValue(artStyle.name);
  const recipeStillGenerating = agentStatus(messages ?? [], "recipe_generator") === "running";

  let globalShotNumber = 1;
  const chapters = scenes.map((scene, sceneIndex) => {
    const shots = arrayRecords(scene.shots);
    const displayShots = expandStoryboardShots(scene, shots.length ? shots : [{
      description: textValue(scene.script),
      visualElements: textValue(scene.visualPrompt),
      dialogue: [{ speaker: "旁白", text: textValue(scene.script) }],
    }]);
    return {
      title: `第${sceneIndex + 1}幕：${textValue(scene.title, t("sections.scenePlaceholder"))}`,
      meta: "白天 室内",
      shots: displayShots.map((shot, shotIndex) => {
        const shotNumber = globalShotNumber++;
        const blockTitle = `${textValue(scene.title, t("sections.scenePlaceholder"))} - ${textValue(shot.title)}`;
        const shotId = textValue(shot.shotId);
        return {
          shotNumber,
          audioUrl: (shotId ? shotAudio.byShotId.get(shotId) : undefined) || shotAudio.byTaskId.get(`voice-${shotNumber}`) || shotAudio.bySceneTitle.get(blockTitle),
          fields: storyboardShotFields(shot, scene),
        };
      }),
    };
  });

  const firstShot = chapters.flatMap((chapter) => chapter.shots)[0];
  const firstSubjectAudio = characters.map(audioValue).find(Boolean);

  const mediaAssetsData = latestDataPart(messages ?? [], "data-media-assets");
  const rawAssets = arrayRecords(mediaAssetsData.assets);
  const mediaImages = rawAssets
    .filter((a) => String(a.type ?? "").toUpperCase() === "IMAGE")
    .map((a) => ({ assetId: textValue(a.assetId), url: textValue(a.url), sceneTitle: textValue(a.sceneTitle), shotId: textValue(a.shotId) || undefined, prompt: textValue(a.prompt) || undefined }));
  const mediaAudio = rawAssets
    .filter((a) => String(a.type ?? "").toUpperCase() === "AUDIO")
    .map((a) => ({ assetId: textValue(a.assetId), url: textValue(a.url), sceneTitle: textValue(a.sceneTitle), shotId: textValue(a.shotId) || undefined, tool: textValue(a.tool) }));

  return {
    storyOutline: {
      title: t("sections.storyOutline"),
      contentLabel: "内容梗概",
      content: storyContent({ ...recipe, title }, scenes),
      highlightsTitle: "剧本亮点",
      highlights: storyHighlights(recipe, scenes),
    },
    subjects: (characters.length ? characters : [{ name: t("sections.waitingSubjects"), description: t("workflow.subjectsAndStylePending"), loading: true }]).map((character, index) => {
      const imageUrl = imageValue(character) || subjectImageByIndex.get(index) || undefined;
      return {
      name: textValue(character.name, `${t("sections.subject")} ${index + 1}`),
      description: textValue(character.description),
      imageUrl,
      audioUrl: audioValue(character) || undefined,
      loading: !imageUrl && (Boolean(character.loading) || waitingSubjects || recipeStillGenerating || hasPendingSubjectImageTask(runnerTasks, index)),
      };
    }),
    scenes: (scenes.length ? scenes : [{ title: t("sections.waitingScenes"), visualPrompt: t("workflow.scenesAndStoryboardPending"), loading: true }]).map((scene, index) => {
      const imageUrl = imageValue(scene) || sceneImageByTitle.get(textValue(scene.title)) || undefined;
      return {
      name: textValue(scene.title, t("sections.scenePlaceholder")),
      description: firstText(scene.planningDescription, scene.desc, scene.visualPrompt, scene.script),
      imageUrl,
      loading: !imageUrl && (Boolean(scene.loading) || waitingScenes || recipeStillGenerating || hasPendingSceneImageTask(runnerTasks, scene, index)),
      };
    }),
    artStyle: {
      title: t("sections.artStyle"),
      baseLabel: "基础画风风格",
      baseStyle: textValue(artStyle.name, t("sections.waitingStyle")),
      description: firstText(artStyle.planningDescription, artStyle.description, artStyle.detail, artStyle.promptPrefix, "等待美术风格说明。"),
      imageUrl: imageValue(artStyle) || undefined,
      loading: waitingArtStyle,
    },
    storyboard: {
      title: t("sections.storyboard"),
      sceneCount: scenes.length,
      voiceRole: firstShot?.fields.voiceRole ?? "旁白",
      voiceAudioUrl: firstSubjectAudio || undefined,
      bgmAudioUrl,
      loading: waitingScenes,
      chapters,
    },
    mediaAssets: {
      title: "已生成媒体",
      images: mediaImages,
      audio: mediaAudio,
    },
  };
}

export function createVideoCommand() {
  return "创作视频";
}

export function creationActionLabel(t: TranslationFn, _hasPreparedMedia: boolean) {
  return t("creation.previewAndExport");
}

export function buildCreationActionState(
  t: TranslationFn,
  input: {
    chatStatus: string;
    creationReady: boolean;
    creationBusy: boolean;
    hasRecipe: boolean;
    hasRunnerTasks: boolean;
  },
): CreationActionState {
  if (input.creationBusy) {
    return { label: t("creation.preparing"), disabled: true, loading: true };
  }
  if (input.chatStatus === "submitted" || input.chatStatus === "streaming") {
    return { label: t("creation.planning"), disabled: true, loading: true };
  }
  if (!input.hasRecipe || !input.hasRunnerTasks) {
    return { label: t("creation.previewAndExport"), disabled: true, loading: false };
  }
  return {
    label: creationActionLabel(t, input.creationReady),
    disabled: false,
    loading: false,
  };
}

export function isCreateVideoCommand(prompt: string) {
  const value = prompt.trim().toLowerCase();
  return value === "创作视频" || value === "开始创作视频" || value === "create video" || value === "generate video";
}

export function latestDataPart(messages: StudioMessage[], type: string) {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = messages[messageIndex];
    for (let partIndex = (message.parts ?? []).length - 1; partIndex >= 0; partIndex -= 1) {
      const part = message.parts?.[partIndex];
      if (part?.type === type) return asRecord(part.data);
    }
  }
  return {};
}

function hasData(messages: StudioMessage[], type: string) {
  return Object.keys(latestDataPart(messages, type)).length > 0;
}

export function hasCreationImageAssets(assets: CreationAssetLike[]) {
  return assets.some((asset) => {
    const metadata = asRecord(asset.metadata);
    const task = asRecord(metadata.task);
    return String(asset.type ?? "").toUpperCase() === "IMAGE" && textValue(task.tool) === "image_to_image";
  });
}

export function buildCreationPreparationSteps(t: TranslationFn, elapsedSeconds: number): CreationPreparationStep[] {
  const safeElapsed = Math.max(0, elapsedSeconds);
  const definitions = [
    { title: t("creation.prepAnalyze"), detail: t("creation.prepAnalyzeDetail"), duration: 3 },
    { title: t("creation.prepImage"), detail: t("creation.prepImageDetail"), duration: 4 },
    { title: t("creation.prepAudio"), detail: t("creation.prepAudioDetail"), duration: 4 },
    { title: t("creation.prepPackage"), detail: t("creation.prepPackageDetail"), duration: 3 },
    { title: t("creation.prepWrite"), detail: t("creation.prepWriteDetail"), duration: 2 },
  ];

  let elapsedBeforeStep = 0;
  return definitions.map((definition) => {
    const rawProgress = ((safeElapsed - elapsedBeforeStep) / definition.duration) * 100;
    const progress = Math.max(0, Math.min(100, Math.round(rawProgress)));
    elapsedBeforeStep += definition.duration;
    return {
      title: definition.title,
      detail: definition.detail,
      progress,
      status: progress >= 100 ? "completed" : progress > 0 ? "running" : "pending",
    };
  });
}

function agentStatus(messages: StudioMessage[], node: string) {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const parts = messages[messageIndex].parts ?? [];
    for (let partIndex = parts.length - 1; partIndex >= 0; partIndex -= 1) {
      const part = parts[partIndex];
      if (part.type !== "data-agent-status") continue;
      const data = asRecord(part.data);
      if (data.node === node) return textValue(data.status, "pending") as WorkflowStatus;
    }
  }
  return "pending";
}

function taskTool(record: Record<string, unknown>) {
  return textValue(record.tool, textValue(asRecord(asRecord(record.metadata).task).tool));
}

function isPlanningMediaTool(tool: string) {
  return ["create_character", "create_location", "image_to_image", "tts_create", "text_to_bgm"].includes(tool);
}

function planningMediaTasks(tasks: Record<string, unknown>[]) {
  return tasks.filter((task) => isPlanningMediaTool(taskTool(task)));
}

function planningMediaAssets(messages: StudioMessage[]) {
  return dataParts(messages, "data-media-assets")
    .flatMap((mediaAssets) => arrayRecords(mediaAssets.assets))
    .filter((asset) => isPlanningMediaTool(taskTool(asset)));
}

function taskIdentity(record: Record<string, unknown>) {
  const metadataTask = asRecord(asRecord(record.metadata).task);
  return {
    id: textValue(record.id, textValue(record.taskId, textValue(metadataTask.id))),
    tool: taskTool(record),
    sceneTitle: textValue(record.sceneTitle, textValue(metadataTask.sceneTitle)),
  };
}

function mediaAssetKeys(assets: Record<string, unknown>[]) {
  const keys = new Set<string>();
  for (const asset of assets) {
    const identity = taskIdentity(asset);
    if (identity.id) keys.add(`id:${identity.id}`);
    if (identity.tool && identity.sceneTitle) keys.add(`pair:${identity.tool}:${identity.sceneTitle}`);
  }
  return keys;
}

function pendingMediaTasks(tasks: Record<string, unknown>[], assets: Record<string, unknown>[]) {
  const assetKeys = mediaAssetKeys(assets);
  return tasks.filter((task) => {
    const identity = taskIdentity(task);
    if (identity.id && assetKeys.has(`id:${identity.id}`)) return false;
    if (identity.tool && identity.sceneTitle && assetKeys.has(`pair:${identity.tool}:${identity.sceneTitle}`)) return false;
    return true;
  });
}

function mediaTaskLabel(task: Record<string, unknown>) {
  const tool = taskTool(task);
  const title = textValue(task.sceneTitle, textValue(task.title, "媒体任务"));
  const label = tool === "create_character"
    ? "角色图"
    : tool === "create_location"
      ? "场景图"
      : tool === "image_to_image"
        ? "分镜图"
        : tool === "tts_create"
          ? "配音"
          : tool === "text_to_bgm"
            ? "背景音乐"
            : "媒体";
  return `${label}「${title}」`;
}

function latestRunnerProgress(messages: StudioMessage[]) {
  return latestDataPart(messages, "data-runner-progress");
}

function shotCount(scenes: Record<string, unknown>[]) {
  return scenes.reduce((total, scene) => total + arrayRecords(scene.shots).length, 0);
}

function expandedStoryboardShotCount(scenes: Record<string, unknown>[]) {
  return scenes.reduce((total, scene) => {
    const shots = arrayRecords(scene.shots);
    return total + expandStoryboardShots(scene, shots).length;
  }, 0);
}

export function buildWorkflowActivity(messages: StudioMessage[], chatStatus: string, t: TranslationFn): WorkflowActivity[] {
  const brief = latestDataPart(messages, "data-director-brief");
  const recipe = latestDataPart(messages, "data-recipe");
  const artStyle = asRecord(recipe.artStyle);
  const characters = filterReusableVisualSubjects(Array.isArray(recipe.characters) ? recipe.characters.map(asRecord) : []);
  const scenes = Array.isArray(recipe.scenes) ? recipe.scenes.map(asRecord) : [];
  const runnerTasks = latestDataPart(messages, "data-runner-tasks");
  const runnerProgress = latestRunnerProgress(messages);
  const tasks = Array.isArray(runnerTasks.tasks) ? runnerTasks.tasks.map(asRecord) : [];
  const runningMediaTasks = arrayRecords(runnerProgress.running);
  const mediaTasks = planningMediaTasks(tasks);
  const assets = planningMediaAssets(messages);
  const pendingTasks = pendingMediaTasks(mediaTasks, assets);
  const hasBrief = hasData(messages, "data-director-brief");
  const hasRecipe = hasData(messages, "data-recipe");
  const recipeStatus = agentStatus(messages, "recipe_generator");
  const mediaAgentStatus = agentStatus(messages, "media_agent");
  const runnerStatus = agentStatus(messages, "runner");
  const mediaStatus = runnerStatus !== "pending" ? runnerStatus : mediaAgentStatus;
  const recipeStarted = recipeStatus === "running" || recipeStatus === "completed" || hasRecipe;
  const hasStory = Boolean(textValue(recipe.title));
  const hasSubjects = characters.length > 0;
  const hasArtStyle = Boolean(textValue(artStyle.name));
  const hasScenes = scenes.length > 0;
  const shots = expandedStoryboardShotCount(scenes) || shotCount(scenes);
  const hasStoryboard = shots > 0 || tasks.length > 0;
  const mediaReadyCount = Math.min(assets.length, mediaTasks.length || assets.length);
  const mediaTaskCount = mediaTasks.length || assets.length;

  return [
    {
      title: t("workflow.directorBrief"),
      detail: hasBrief
        ? t("workflow.directorBriefDetail", { title: textValue(brief.project_name, textValue(brief.title, t("studio.newVideoDirection"))) })
        : t("workflow.directorBriefPending"),
      status: recipeStarted ? "completed" : hasBrief || chatStatus === "streaming" || chatStatus === "submitted" ? "running" : "pending",
    },
    {
      title: t("workflow.storyOutline"),
      detail: hasRecipe
        ? t("workflow.storyOutlineDetail", { title: textValue(recipe.title, t("planning.untitledStory")) })
        : t("workflow.storyOutlinePending"),
      status: hasRecipe ? "completed" : recipeStarted ? "running" : "pending",
    },
    {
      title: t("workflow.subjects"),
      detail: hasSubjects
        ? t("workflow.subjectsDetail", { characterCount: characters.length })
        : t("workflow.subjectsPending"),
      status: hasSubjects ? "completed" : hasStory ? "running" : "pending",
    },
    {
      title: t("workflow.artStyle"),
      detail: hasArtStyle
        ? t("workflow.artStyleDetail", { styleName: textValue(artStyle.name, t("sections.waitingStyle")) })
        : t("workflow.artStylePending"),
      status: hasArtStyle ? "completed" : hasSubjects ? "running" : "pending",
    },
    {
      title: t("workflow.scenes"),
      detail: hasScenes
        ? t("workflow.scenesDetail", { sceneCount: scenes.length })
        : t("workflow.scenesPending"),
      status: hasScenes ? "completed" : hasArtStyle ? "running" : "pending",
    },
    {
      title: t("workflow.storyboard"),
      detail: hasStoryboard
        ? t("workflow.storyboardDetail", { shotCount: shots || scenes.length, taskCount: mediaTasks.length })
        : t("workflow.storyboardPending"),
      status: hasStoryboard ? "completed" : hasScenes ? "running" : "pending",
    },
    {
      title: t("workflow.mediaGeneration"),
      detail: runningMediaTasks.length
        ? t("workflow.mediaGenerationRunning", {
          tasks: runningMediaTasks.slice(0, 4).map(mediaTaskLabel).join("、"),
        })
        : mediaTaskCount > 0 && pendingTasks.length > 0 && (chatStatus === "streaming" || chatStatus === "submitted" || mediaStatus === "running" || mediaStatus === "pending")
          ? t("workflow.mediaGenerationRunning", {
            tasks: pendingTasks.slice(0, 4).map(mediaTaskLabel).join("、"),
          })
        : mediaAgentStatus === "running" && mediaTaskCount === 0
          ? t("workflow.mediaGenerationPreparing")
        : mediaReadyCount
        ? t("workflow.mediaGenerationDetail", { readyCount: mediaReadyCount, taskCount: mediaTaskCount })
        : mediaTaskCount
          ? t("workflow.mediaGenerationTasks", { taskCount: mediaTaskCount })
          : t("workflow.mediaGenerationPending"),
      status: mediaTaskCount > 0 && mediaReadyCount >= mediaTaskCount
        ? "completed"
        : mediaStatus === "running" || mediaTaskCount > 0
          ? "running"
          : mediaStatus === "failed"
            ? "failed"
            : "pending",
    },
  ];
}

export function buildPlanningSections(t: TranslationFn, messages?: StudioMessage[]): PlanningSection[] {
  if (!messages) {
    return [];
  }
  const recipe = latestDataPart(messages, "data-recipe");
  const runnerTasks = latestDataPart(messages, "data-runner-tasks");
  const scenes = Array.isArray(recipe.scenes) ? recipe.scenes.map(asRecord) : [];
  const characters = filterReusableVisualSubjects(Array.isArray(recipe.characters) ? recipe.characters.map(asRecord) : []);
  const artStyle = asRecord(recipe.artStyle);
  const bgm = asRecord(recipe.bgm);
  const createMusicParams = asRecord(bgm.createMusicParams);
  const createMusicTags = Array.isArray(createMusicParams.tags) ? createMusicParams.tags.map((tag) => textValue(tag)).filter(Boolean) : [];

  return [
    {
      title: t("sections.storyOutline"),
      status: hasData(messages, "data-recipe") ? "completed" : hasData(messages, "data-director-brief") ? "running" : "pending",
      items: [
        {
          title: textValue(recipe.title, t("sections.waitingStory")),
          body: hasData(messages, "data-recipe")
            ? `${textValue(recipe.title)} ${t("sections.storyOutline")}`
            : t("workflow.storyOutlinePending"),
          meta: textValue(bgm.prompt) || createMusicTags.length ? `${t("planning.bgm")}：${textValue(bgm.prompt, createMusicTags.join(", "))}` : undefined,
        },
      ],
    },
    {
      title: t("sections.artStyle"),
      status: hasData(messages, "data-recipe") ? "completed" : "pending",
      items: [{ title: textValue(artStyle.name, t("sections.waitingStyle")), body: textValue(artStyle.description, textValue(artStyle.detail, t("workflow.subjectsAndStylePending"))), meta: textValue(artStyle.promptPrefix, textValue(artStyle.imagePrompt)) ? `${t("sections.stylePrefix")}：${textValue(artStyle.promptPrefix, textValue(artStyle.imagePrompt))}` : undefined, imageUrl: imageValue(artStyle) || undefined }],
    },
    {
      title: t("sections.subjectList"),
      status: characters.length ? "completed" : "pending",
      items: (characters.length ? characters : [{ name: t("sections.waitingSubjects"), description: t("workflow.subjectsAndStylePending"), voice: "" }]).map((character, index) => ({
        title: textValue(character.name, `${t("sections.subject")} ${index + 1}`),
        body: textValue(character.description),
        meta: [
          textValue(character.type) ? `${t("sections.type")}：${textValue(character.type)}` : "",
          textValue(character.voiceId, textValue(character.voice)) ? `${t("sections.voice")}：${textValue(character.voiceId, textValue(character.voice))}` : "",
        ].filter(Boolean).join(" · ") || undefined,
        imageUrl: imageValue(character) || undefined,
        audioUrl: audioValue(character) || undefined,
      })),
    },
    {
      title: t("sections.sceneList"),
      status: scenes.length ? "completed" : hasData(messages, "data-recipe") ? "running" : "pending",
      items: (scenes.length ? scenes : [{ title: t("sections.waitingScenes"), visualPrompt: t("workflow.scenesAndStoryboardPending"), duration: "" }]).map((scene, index) => ({
        title: scenes.length ? `${index + 1}. ${textValue(scene.title, t("sections.scenePlaceholder"))}` : textValue(scene.title),
        body: textValue(scene.visualPrompt),
        meta: textValue(scene.duration) ? `${textValue(scene.duration)}s` : undefined,
      })),
    },
    {
      title: t("sections.storyboard"),
      status: scenes.length ? "completed" : "pending",
      items: (scenes.length ? scenes : [{ title: t("sections.waitingStoryboard"), script: t("workflow.scenesAndStoryboardPending"), audioPrompt: "" }]).flatMap((scene, sceneIndex) => {
        const shots = Array.isArray(scene.shots) ? scene.shots.map(asRecord) : [];
        if (!shots.length) {
          return [{
            title: scenes.length ? `${t("sections.shot")} ${sceneIndex + 1}：${textValue(scene.title, t("sections.scenePlaceholder"))}` : textValue(scene.title),
            body: textValue(scene.script),
            meta: textValue(scene.audioPrompt) ? `${t("sections.voice")}：${textValue(scene.audioPrompt)}` : undefined,
          }];
        }
        return shots.map((shot, shotIndex) => ({
          title: `${t("sections.shot")} ${sceneIndex + 1}.${shotIndex + 1}：${textValue(shot.title, textValue(scene.title, t("sections.scenePlaceholder")))}`,
          body: textValue(shot.description),
          meta: textValue(shot.visualElements) ? `${t("planning.visual")}：${textValue(shot.visualElements)}` : undefined,
        }));
      }),
    },
  ];
}
