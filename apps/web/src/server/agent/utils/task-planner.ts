import { filterReusableVisualSubjects } from "@/lib/planning-subjects";
import { executeRunnerTasks, type AspectRatio, type RunnerTask } from "@/server/agent/media-provider";
import type { DirectorRecipe, DirectorRecipeWithAspectRatio } from "@/server/agent/schemas/recipe";
import { prisma } from "@/server/db/prisma";
import { AssetType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { normalizeRecipe } from "./recipe-normalize";
import { loadPublicArtStyles } from "@/server/agent/art-styles";
import { loadAvailableVoices } from "@/server/agent/voices";

export function asStateRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function textValue(value: unknown, fallback = "") {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : fallback;
}

function assetTaskTool(asset: { metadata: Prisma.JsonValue | null }) {
  const metadata = asStateRecord(asset.metadata);
  return textValue(asStateRecord(metadata.task).tool);
}

export function planRunnerTasks(recipe: DirectorRecipe): RunnerTask[] {
  return [
    ...planPlanningSubjectTasks(recipe),
    ...planSceneImageTasks(recipe),
    ...planBgmTasks(recipe),
    ...planCreationPreparationTasks(recipe),
    // ...planVideoTasks(recipe),
    ...planVoiceTasks(recipe),
  ];
}

export function planPlanningAudioTasks(recipe: DirectorRecipe): RunnerTask[] {
  return [...planVoiceTasks(recipe), ...planBgmTasks(recipe)];
}

export function planCreationEditorAssetTasks(
  recipe: DirectorRecipe,
): RunnerTask[] {
  return [
    ...planSceneImageTasks(recipe),
    ...planCreationPreparationTasks(recipe),
    ...planVoiceTasks(recipe),
    ...planBgmTasks(recipe),
  ];
}

export async function ensurePlanningSubjectImages(input: {
  threadId: string;
  userId?: string;
  recipeId: string;
  recipe: DirectorRecipe;
}) {
  const subjectTasks = planPlanningSubjectTasks(input.recipe);
  if (!subjectTasks.length) return input.recipe;

  const assets = await executeRunnerTasks({
    threadId: input.threadId,
    userId: input.userId,
    recipeId: input.recipeId,
    tasks: subjectTasks,
    blocks: [],
  });
  const updatedCharacters = input.recipe.characters.map((character, index) => ({
    ...character,
    imageUrl: character.imageUrl || assets[index]?.url || null,
  }));
  const recipe = { ...input.recipe, characters: updatedCharacters };

  await prisma.recipe.update({
    where: { id: input.recipeId },
    data: { content: toJson(recipe) },
  });
  const coverUrl = updatedCharacters.find(
    (character) => character.imageUrl,
  )?.imageUrl;
  if (coverUrl) {
    await prisma.thread.update({
      where: { id: input.threadId },
      data: { coverUrl },
    });
  }
  await prisma.agentState.update({
    where: { threadId: input.threadId },
    data: {
      state: toJson({
        current_node: "block_planner",
        recipeId: input.recipeId,
        recipes: recipe,
        subjectAssets: assets,
      }),
    },
  });
  await prisma.subject.createMany({
    data: updatedCharacters
      .filter((character) => character.imageUrl)
      .map((character) => ({
        userId: input.userId,
        name: character.name,
        description: character.description,
        imageUrl: character.imageUrl,
        metadata: toJson({
          threadId: input.threadId,
          recipeId: input.recipeId,
          type: character.type,
          promptText: character.promptText,
        }),
      })),
  });

  return recipe;
}

export async function hasPreparedCreationMedia(threadId: string) {
  const assets = await prisma.asset.findMany({
    where: { threadId, type: AssetType.IMAGE },
    select: { metadata: true },
  });
  return assets.some((asset) => assetTaskTool(asset) === "image_to_image");
}

export function filterExistingCreationTasks(
  tasks: RunnerTask[],
  existingAssets: Array<{
    blockId: string | null;
    metadata: Prisma.JsonValue | null;
  }>,
  blocks: Array<{ id: string; title: string }>,
) {
  const blockByTitle = new Map(blocks.map((block) => [block.title, block]));
  const existingBgm = existingAssets.some(
    (asset) => assetTaskTool(asset) === "text_to_bgm",
  );
  const existingByBlockAndTool = new Set(
    existingAssets
      .map((asset) => `${asset.blockId || ""}:${assetTaskTool(asset)}`)
      .filter((key) => !key.endsWith(":")),
  );

  return tasks.filter((task) => {
    if (task.tool === "text_to_bgm") return !existingBgm;
    const block = blockByTitle.get(task.sceneTitle);
    if (!block) return true;
    return !existingByBlockAndTool.has(`${block.id}:${task.tool}`);
  });
}

export async function prepareCreationMedia(input: {
  threadId: string;
  userId?: string;
}) {
  const recipeRow = await prisma.recipe.findFirst({
    where: { threadId: input.threadId },
    orderBy: [{ version: "desc" }, { createdAt: "desc" }],
  });
  if (!recipeRow) {
    throw new Error("没有找到可执行的 recipe，请先完成策划。");
  }

  const artStyleCatalog = await loadPublicArtStyles();
  const voiceCatalog = await loadAvailableVoices(input.userId);
  let recipe = normalizeRecipe(
    recipeRow.content as DirectorRecipe,
    artStyleCatalog,
    voiceCatalog,
  );
  if (recipe.characters.some((character) => !character.imageUrl)) {
    recipe = await ensurePlanningSubjectImages({
      ...input,
      recipeId: recipeRow.id,
      recipe,
    });
  }

  const blocks = await prisma.block.findMany({
    where: { threadId: input.threadId },
    select: { id: true, title: true },
    orderBy: { order: "asc" },
  });
  const existingAssets = await prisma.asset.findMany({
    where: { threadId: input.threadId },
    select: { blockId: true, metadata: true },
  });
  const tasks = filterExistingCreationTasks(
    planCreationEditorAssetTasks(recipe),
    existingAssets,
    blocks,
  );
  if (!tasks.length) {
    return { ready: true, created: false, assets: [] };
  }
  const assets = await executeRunnerTasks({
    threadId: input.threadId,
    userId: input.userId,
    recipeId: recipeRow.id,
    tasks,
    blocks,
  });
  return { ready: true, created: true, assets };
}

export function planPlanningSubjectTasks(recipe: DirectorRecipe): RunnerTask[] {
  const aspectRatio = resolveRecipeAspectRatio(recipe as DirectorRecipeWithAspectRatio);
  const tasks: RunnerTask[] = [];
  const characters = filterReusableVisualSubjects(recipe.characters).filter(
    (character) => character.type === "character",
  );
  const existingReferenceUrl =
    characters.find((character) => character.imageUrl)?.imageUrl ||
    recipe.artStyle.imageUrl;
  const validReferenceUrl = isValidHttpUrl(existingReferenceUrl) ? existingReferenceUrl : undefined;

  for (const [index, character] of characters.entries()) {
    if (character.imageUrl) continue;
    const id = `character-${index + 1}`;
      tasks.push({
        id,
        tool: "create_character",
        sceneTitle: "角色列表",
        prompt: `${recipe.artStyle.promptPrefix}, ${character.promptText || character.description}, single character, front view, clean background, no text, no watermark`,
        status: "planned",
        aspectRatio,
      });
  }
  return tasks;
}

function mediaShotPromptByShotId(recipe: DirectorRecipe) {
  return new Map(recipe.media.shots.map((shot) => [shot.shotId, shot]));
}

export function planCreationPreparationTasks(
    recipe: DirectorRecipe,
  ): RunnerTask[] {
    const aspectRatio = resolveRecipeAspectRatio(recipe as DirectorRecipeWithAspectRatio);
    const characters = filterReusableVisualSubjects(recipe.characters).filter(
      (character) => character.type === "character",
    );
  const subjectReferenceUrl =
    characters.find((character) => character.imageUrl)?.imageUrl ||
    recipe.artStyle.imageUrl ||
    undefined;
  const validSubjectReferenceUrl = isValidHttpUrl(subjectReferenceUrl) ? subjectReferenceUrl : undefined;
  const subjectDependency = validSubjectReferenceUrl
    ? undefined
    : characters.some((character) => !character.imageUrl)
      ? "character-1"
      : undefined;
  const mediaByShotId = mediaShotPromptByShotId(recipe);

  return buildStoryboardBlocks(recipe)
    .map((block, index): RunnerTask => {
      const shot = asStateRecord(block.metadata.shot);
      const sceneIndex = Number(block.metadata.sceneIndex || 1);
      const mediaPrompt = mediaByShotId.get(textValue(shot.shotId));
      const dependsOn = [
        subjectDependency,
        `scene-${sceneIndex}-image`,
      ].filter((value): value is string => Boolean(value));
      const referenceUrls = [validSubjectReferenceUrl].filter((value): value is string => Boolean(value));
        return {
          id: `shot-${index + 1}-image`,
          tool: "image_to_image",
          sceneTitle: block.title,
          prompt: (mediaPrompt?.imageToImagePromptText || block.visualPrompt).trim(),
          status: "planned",
          dependsOn: dependsOn.length ? dependsOn : undefined,
          referenceUrls: referenceUrls.length ? referenceUrls : undefined,
          shotId: textValue(shot.shotId) || undefined,
          aspectRatio,
        };
    })
    .filter((task) => task.dependsOn || task.referenceUrls?.length);
}

function planSceneImageTasks(recipe: DirectorRecipe): RunnerTask[] {
  const aspectRatio = resolveRecipeAspectRatio(recipe as DirectorRecipeWithAspectRatio);
    return recipe.scenes.map((scene, index) => ({
      id: `scene-${index + 1}-image`,
      tool: "create_location" as const,
      sceneTitle: scene.title,
      prompt: buildSceneImagePrompt(recipe, scene),
      status: "planned" as const,
      aspectRatio,
    }));
  }

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function removeSubjectNamesFromPrompt(value: string, recipe: DirectorRecipe) {
  return filterReusableVisualSubjects(recipe.characters).reduce((text, character) => {
    const name = character.name.trim();
    if (!name) return text;
    return text.replace(new RegExp(escapeRegExp(name), "gi"), "");
  }, value);
}

function compactPromptText(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s*([，。；、,. ;:])\s*/g, "$1 ")
    .replace(/(?:,\s*){2,}/g, ", ")
    .replace(/(?:，\s*){2,}/g, "，")
    .trim()
    .replace(/^[,，。；、\s]+|[,，。；、\s]+$/g, "");
}

function buildSceneImagePrompt(recipe: DirectorRecipe, scene: DirectorRecipe["scenes"][number]) {
  const location = matchingLocationForScene(recipe, scene);
  const rawEnvironment = [
    location?.promptText,
    location?.description,
    scene.visualPrompt,
    scene.desc,
    scene.title,
  ].filter(Boolean).join(", ");
  const environment = compactPromptText(
    removeSubjectNamesFromPrompt(rawEnvironment, recipe),
  ) || "the location environment, architecture, landscape, lighting, atmosphere";

  return [
    recipe.artStyle.promptPrefix,
    "EMPTY ENVIRONMENT PLATE",
    "background only",
    "location concept art",
    environment,
    "wide establishing composition",
    "clear open space for later subject placement",
    "no characters",
    "no animals",
    "no people",
    "no main subject",
    "no products",
    "no text",
    "no watermark",
  ].join(", ");
}

function matchingLocationForScene(
  recipe: DirectorRecipe,
  scene: DirectorRecipe["scenes"][number],
) {
  const haystack = [
    scene.title,
    scene.desc,
    scene.visualPrompt,
    scene.script,
  ].filter(Boolean).join(" ").toLowerCase();
  return recipe.locations.find((location) => {
    const name = location.name.trim().toLowerCase();
    return name.length > 0 && haystack.includes(name);
  });
}

export function planPlanningSceneImageTasks(
  recipe: DirectorRecipe,
): RunnerTask[] {
  return [...planSceneImageTasks(recipe), ...planCreationPreparationTasks(recipe)];
}

function planBgmTasks(recipe: DirectorRecipe): RunnerTask[] {
  const bgmTags =
    recipe.bgm.createMusicParams?.tags?.join(", ") ||
    recipe.bgm.prompt ||
    "background music, suitable for narration";
  return [
    {
      id: "bgm-1",
      tool: "text_to_bgm" as const,
      sceneTitle: "背景音乐",
      prompt: bgmTags,
      status: "planned" as const,
    },
  ];
}

function characterVoiceIdByName(recipe: DirectorRecipe) {
  return new Map(
    recipe.characters
      .filter((character) => character.voiceId)
      .map((character) => [character.name, character.voiceId as string]),
  );
}

function voiceIdForBlock(recipe: DirectorRecipe, block: ReturnType<typeof buildStoryboardBlocks>[number]) {
  const voicesByCharacter = characterVoiceIdByName(recipe);
  const shot = block.metadata.shot as DirectorRecipe["scenes"][number]["shots"][number] | undefined;
  const speaker = shot?.dialogue?.[0]?.speaker;
  if (speaker) {
    const characterVoice = voicesByCharacter.get(speaker);
    if (characterVoice) return characterVoice;
  }
  // Narrator voice: use dedicated narrator voice if available, otherwise fallback
  const narratorVoiceId = (recipe as Record<string, unknown>).narratorVoiceId as string | undefined;
  return narratorVoiceId || recipe.characters.find((character) => character.voiceId)?.voiceId || undefined;
}

function planVoiceTasks(recipe: DirectorRecipe): RunnerTask[] {
  return buildStoryboardBlocks(recipe).map((block, index) => ({
    id: `voice-${index + 1}`,
    tool: "tts_create",
    sceneTitle: block.title,
    prompt: block.script,
    status: "planned",
    shotId: textValue(block.metadata.shotId) || undefined,
    voiceId: voiceIdForBlock(recipe, block),
    emotion: "happy",
    speed: 1.1,
    pitch: 0,
    volume: 1,
  }));
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function isValidHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function resolveRecipeAspectRatio(recipe: DirectorRecipeWithAspectRatio): AspectRatio {
  return recipe.aspectRatio === "16:9" || recipe.aspectRatio === "9:16" || recipe.aspectRatio === "1:1"
    ? recipe.aspectRatio
    : "16:9";
}

function sceneVisualPrompt(scene: DirectorRecipe["scenes"][number]) {
  if (scene.shots.length) {
    return scene.shots.map((shot) => shot.visualElements).join("\n");
  }
  return scene.visualPrompt;
}

function sceneScript(scene: DirectorRecipe["scenes"][number]) {
  if (scene.shots.length) {
    return (
      scene.shots
        .flatMap((shot) =>
          shot.dialogue.map((line) => `${line.speaker}: ${line.text}`),
        )
        .join("\n") || scene.script
    );
  }
  return scene.script;
}

function sceneAudioPrompt(scene: DirectorRecipe["scenes"][number]) {
  if (scene.shots.length) {
    return scene.shots.map((shot) => shot.description).join("\n");
  }
  return scene.audioPrompt;
}

function shotDialogueScript(
  shot: DirectorRecipe["scenes"][number]["shots"][number],
  scene: DirectorRecipe["scenes"][number],
) {
  return (
    shot.dialogue.map((line) => line.text).filter(Boolean).join("\n") ||
    scene.script ||
    shot.description
  );
}

function storyboardShots(
  scene: DirectorRecipe["scenes"][number],
  sceneIndex: number,
): DirectorRecipe["scenes"][number]["shots"] {
  if (scene.shots.length) return scene.shots;
  return [{
    shotId: `scene${sceneIndex + 1}_shot01`,
    title: scene.title,
    description: scene.script,
    characters: [],
    visualElements: scene.visualPrompt,
    dialogue: [{ speaker: "旁白", text: scene.script }],
  }];
}

export function buildStoryboardBlocks(recipe: DirectorRecipe) {
  const blocks: Array<{
    order: number;
    title: string;
    script: string;
    visualPrompt: string;
    audioPrompt: string;
    metadata: Record<string, unknown>;
  }> = [];

  for (const [sceneIndex, scene] of recipe.scenes.entries()) {
    const shots = storyboardShots(scene, sceneIndex);

    for (const [shotIndex, shot] of shots.entries()) {
      blocks.push({
        order: blocks.length + 1,
        title: `${scene.title} - ${shot.title}`,
        script: shotDialogueScript(shot, scene),
        visualPrompt: shot.visualElements || scene.visualPrompt,
        audioPrompt: shot.description || scene.audioPrompt,
        metadata: {
          duration: Math.max(
            1,
            Math.round(scene.duration / Math.max(1, shots.length)),
          ),
          desc: scene.desc,
          sceneTitle: scene.title,
          sceneIndex: sceneIndex + 1,
          shotIndex: shotIndex + 1,
          shotId: shot.shotId,
          shot,
          artStyle: recipe.artStyle,
          media: recipe.media.shots.filter(
            (item) => item.shotId === shot.shotId,
          ),
        },
      });
    }
  }

  return blocks;
}

function sceneMetadata(
  recipe: DirectorRecipe,
  scene: DirectorRecipe["scenes"][number],
) {
  return {
    duration: scene.duration,
    desc: scene.desc,
    shots: scene.shots,
    artStyle: recipe.artStyle,
    media: recipe.media.shots.filter((item) => item.sceneTitle === scene.title),
  };
}

export function parseRunnerExecutionState(value: unknown) {
  const state = asStateRecord(value);
  const recipeId = textValue(state.recipeId);
  const tasks = Array.isArray(state.runnerTasks)
    ? state.runnerTasks
        .map(asRunnerTask)
        .filter((task): task is RunnerTask => Boolean(task))
    : [];
  return { recipeId, tasks };
}

function asRunnerTask(value: unknown): RunnerTask | undefined {
  const task = asStateRecord(value);
  const tool = textValue(task.tool) as RunnerTask["tool"];
  if (
    ![
      "create_character",
      "image_to_image",
      "create_location",
      "text_to_bgm",
      "tts_create",
    ].includes(tool)
  )
    return undefined;
  const id = textValue(task.id);
  const sceneTitle = textValue(task.sceneTitle);
  const prompt = textValue(task.prompt);
  if (!id || !sceneTitle || !prompt) return undefined;
  return {
    id,
    tool,
    sceneTitle,
    prompt,
    status: "planned",
    dependsOn: Array.isArray(task.dependsOn)
      ? task.dependsOn.map((value) => textValue(value)).filter(Boolean)
      : textValue(task.dependsOn) || undefined,
    referenceUrl: textValue(task.referenceUrl) || undefined,
    referenceUrls: Array.isArray(task.referenceUrls)
      ? task.referenceUrls.map((value) => textValue(value)).filter(Boolean)
      : undefined,
    shotId: textValue(task.shotId) || undefined,
    voiceId: textValue(task.voiceId) || undefined,
    emotion: textValue(task.emotion) || undefined,
    speed: typeof task.speed === "number" ? task.speed : undefined,
    pitch: typeof task.pitch === "number" ? task.pitch : undefined,
    volume: typeof task.volume === "number" ? task.volume : undefined,
  };
}
