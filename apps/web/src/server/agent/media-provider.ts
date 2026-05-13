import { AssetType, ToolCallStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { createWaveSpeedProvider } from "./providers/wavespeed";

export type AspectRatio = "16:9" | "9:16" | "1:1";

export type RunnerTask = {
  id: string;
  tool: "create_character" | "image_to_image" | "text_to_bgm" | "create_location" | "tts_create";
  sceneTitle: string;
  prompt: string;
  status: "planned" | "running" | "completed" | "failed";
  dependsOn?: string | string[];
  referenceUrl?: string;
  referenceUrls?: string[];
  shotId?: string;
  voiceId?: string;
  emotion?: string;
  speed?: number;
  pitch?: number;
  volume?: number;
  aspectRatio?: AspectRatio;
};

export type GeneratedMediaAsset = {
  taskId: string;
  tool: RunnerTask["tool"];
  assetId: string;
  url: string;
  type: "image" | "audio";
  sceneTitle: string;
  shotId?: string;
  prompt?: string;
};

export type ExecuteRunnerTasksInput = {
  threadId: string;
  userId?: string;
  recipeId: string;
  tasks: RunnerTask[];
  blocks: Array<{ id: string; title: string }>;
  onTaskStatus?: (event: {
    task: RunnerTask;
    status: "running" | "completed" | "failed";
    asset?: GeneratedMediaAsset;
    error?: string;
  }) => void;
};

export type MediaGenerationResult = {
  outputs: string[];
  raw?: unknown;
};

export interface MediaProvider {
  generateImage(prompt: string, options: { aspectRatio?: AspectRatio }): Promise<MediaGenerationResult>;
  generateImageWithReference(
    prompt: string,
    referenceUrls: string[],
    options: { aspectRatio?: AspectRatio },
  ): Promise<MediaGenerationResult>;
  generateTTS(
    text: string,
    options: { voiceId?: string; emotion?: string; speed?: number; pitch?: number; volume?: number },
  ): Promise<MediaGenerationResult>;
  generateBGM(prompt: string): Promise<MediaGenerationResult>;
}

function env(name: string, fallback = "") {
  return process.env[name] || fallback;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function mediaTypeForTool(tool: RunnerTask["tool"]): "image" | "audio" {
  if (tool === "tts_create" || tool === "text_to_bgm") return "audio";
  return "image";
}

function prismaAssetType(type: "image" | "audio") {
  if (type === "audio") return AssetType.AUDIO;
  return AssetType.IMAGE;
}

function runnerConcurrency() {
  const value = Number(env("MEDIA_RUNNER_CONCURRENCY", env("WAVESPEED_RUNNER_CONCURRENCY", "4")));
  return Number.isFinite(value) && value > 0 ? Math.max(1, Math.floor(value)) : 4;
}

function getProvider(): MediaProvider {
  return createWaveSpeedProvider();
}

function buildPayload(task: RunnerTask, dependencyUrls: string[]) {
  const provider = getProvider();

  if (task.tool === "create_character" || task.tool === "create_location") {
    return provider.generateImage(task.prompt, { aspectRatio: task.aspectRatio });
  }

  if (task.tool === "image_to_image") {
    if (!dependencyUrls.length) {
      throw new Error(`image_to_image task ${task.id} requires a subject or style reference image dependency.`);
    }
    return provider.generateImageWithReference(task.prompt, dependencyUrls, { aspectRatio: task.aspectRatio });
  }

  if (task.tool === "tts_create") {
    return provider.generateTTS(task.prompt, {
      voiceId: task.voiceId,
      emotion: task.emotion,
      speed: task.speed,
      pitch: task.pitch,
      volume: task.volume,
    });
  }

  return provider.generateBGM(task.prompt);
}

async function executeSingleRunnerTask(input: ExecuteRunnerTasksInput & {
  task: RunnerTask;
  dependencyUrls: string[];
}) {
  const blockByTitle = new Map(input.blocks.map((block) => [block.title, block]));
  input.onTaskStatus?.({ task: input.task, status: "running" });
  const toolCall = await prisma.toolCall.create({
    data: {
      threadId: input.threadId,
      userId: input.userId,
      name: input.task.tool,
      status: ToolCallStatus.RUNNING,
      args: toJson({ task: input.task }),
    },
  });

  try {
    const result = await buildPayload(input.task, input.dependencyUrls);
    const mediaType = mediaTypeForTool(input.task.tool);
    const block = blockByTitle.get(input.task.sceneTitle);
    const asset = await prisma.asset.create({
      data: {
        threadId: input.threadId,
        userId: input.userId,
        blockId: block?.id,
        type: prismaAssetType(mediaType),
        title: `${input.task.sceneTitle} - ${input.task.tool}`,
        url: result.outputs[0],
        metadata: toJson({
          provider: env("MEDIA_PROVIDER", "aihubmix"),
          task: input.task,
          outputs: result.outputs,
          ...(extractDuration(result.raw) ? { duration: extractDuration(result.raw) } : {}),
        }),
      },
    });

    if (mediaType === "image" && input.threadId) {
      const thread = await prisma.thread.findUnique({
        where: { id: input.threadId },
        select: { coverUrl: true },
      });
      if (thread && !thread.coverUrl) {
        await prisma.thread.update({
          where: { id: input.threadId },
          data: { coverUrl: result.outputs[0] },
        });
      }
    }

    await prisma.toolCall.update({
      where: { id: toolCall.id },
      data: {
        status: ToolCallStatus.COMPLETED,
        result: toJson({ outputs: result.outputs, assetId: asset.id }),
      },
    });

    const generated = {
      taskId: input.task.id,
      tool: input.task.tool,
      assetId: asset.id,
      url: result.outputs[0],
      type: mediaType,
      sceneTitle: input.task.sceneTitle,
      shotId: input.task.shotId,
      prompt: input.task.prompt,
    } satisfies GeneratedMediaAsset;
    input.onTaskStatus?.({ task: input.task, status: "completed", asset: generated });
    return generated;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.toolCall.update({
      where: { id: toolCall.id },
      data: {
        status: ToolCallStatus.FAILED,
        error: message,
      },
    });
    input.onTaskStatus?.({ task: input.task, status: "failed", error: message });
    throw error;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function extractDuration(raw: unknown): number | undefined {
  const record = asRecord(raw);
  const timings = asRecord(record.timings);
  const inferenceMilliseconds = numberValue(timings.inference);
  return inferenceMilliseconds ? inferenceMilliseconds / 1000 : undefined;
}

export async function executeRunnerTasks(input: ExecuteRunnerTasksInput): Promise<GeneratedMediaAsset[]> {
  const resultsByTaskIndex = new Map<number, GeneratedMediaAsset>();
  const byTaskId = new Map<string, GeneratedMediaAsset>();
  const taskIndexes = new Map(input.tasks.map((task, index) => [task.id, index]));
  const pending = new Set(input.tasks.map((task) => task.id));
  const concurrency = runnerConcurrency();

  while (pending.size) {
    const ready = input.tasks
      .filter((task) => pending.has(task.id))
      .filter((task) => {
        const dependsOn = Array.isArray(task.dependsOn)
          ? task.dependsOn
          : task.dependsOn
            ? [task.dependsOn]
            : [];
        return dependsOn.every((taskId) => !taskIndexes.has(taskId) || byTaskId.has(taskId));
      })
      .slice(0, concurrency);

    if (!ready.length) {
      throw new Error(`Runner tasks have unsatisfied or cyclic dependencies: ${Array.from(pending).join(", ")}`);
    }

    const generatedAssets = await Promise.all(ready.map(async (task) => {
      const dependsOn = Array.isArray(task.dependsOn)
        ? task.dependsOn
        : task.dependsOn
          ? [task.dependsOn]
          : [];
      const dependencyUrls = [
        ...(task.referenceUrls ?? []),
        ...(task.referenceUrl ? [task.referenceUrl] : []),
        ...dependsOn.map((taskId) => byTaskId.get(taskId)?.url).filter((url): url is string => Boolean(url)),
      ];
      const generated = await executeSingleRunnerTask({ ...input, task, dependencyUrls });
      return { task, generated };
    }));

    for (const { task, generated } of generatedAssets) {
      const index = taskIndexes.get(task.id);
      if (typeof index === "number") resultsByTaskIndex.set(index, generated);
      byTaskId.set(task.id, generated);
      pending.delete(task.id);
    }
  }

  const results = input.tasks
    .map((task, index) => resultsByTaskIndex.get(index))
    .filter((asset): asset is GeneratedMediaAsset => Boolean(asset));

  await prisma.agentState.update({
    where: { threadId: input.threadId },
    data: {
      currentStep: "media_completed",
      state: toJson({
        current_node: "runner",
        recipeId: input.recipeId,
        runnerTasks: input.tasks.map((task) => ({ ...task, status: "completed" })),
        mediaAssets: results,
      }),
    },
  });

  return results;
}

export function resolveAspectRatio(value: string | undefined | null, fallback: AspectRatio = "16:9"): AspectRatio {
  if (value === "16:9" || value === "9:16" || value === "1:1") return value;
  return fallback;
}
