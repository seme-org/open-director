import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildWaveSpeedPayload, runWaveSpeedPrediction } from "./wavespeed";
import { executeRunnerTasks, type RunnerTask } from "../media-provider";

const mockPrisma = vi.hoisted(() => ({
  toolCall: {
    create: vi.fn(),
    update: vi.fn(),
  },
  asset: {
    create: vi.fn(),
  },
  thread: {
    findUnique: vi.fn().mockResolvedValue({ coverUrl: null }),
    update: vi.fn(),
  },
  agentState: {
    update: vi.fn(),
  },
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("node-edge-tts", () => ({
  EdgeTTS: class {
    ttsPromise = vi.fn(async (_text: string, filePath: string) => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, Buffer.from("edge audio"));
    });
  },
}));

vi.mock("@/server/storage/minio", () => ({
  minioStorage: {
    putObject: vi.fn(async (input: { objectKey: string }) => ({
      publicUrl: input.objectKey.includes("/tts/")
        ? "https://cdn.example/voice.mp3"
        : "https://cdn.example/object.bin",
    })),
  },
}));

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("wavespeed runner integration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, WAVESPEED_API_KEY: "test-key", WAVESPEED_POLL_INTERVAL_MS: "1", WAVESPEED_TIMEOUT_MS: "1000" };
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-04T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    process.env = originalEnv;
  });

  it("builds Wavespeed-compatible payloads from runner tasks", () => {
    const image = buildWaveSpeedPayload({
      id: "image-1",
      tool: "create_location",
      sceneTitle: "Hook",
      prompt: "cinematic opening",
      status: "planned",
    });
    expect(image.modelId).toBe("google/nano-banana/text-to-image");
    expect(image.payload).toMatchObject({
      prompt: "cinematic opening",
      aspect_ratio: "16:9",
      output_format: "png",
      enable_sync_mode: false,
      enable_base64_output: false,
    });
    expect(image.payload).not.toHaveProperty("size");

    const portraitImage = buildWaveSpeedPayload({
      id: "image-portrait",
      tool: "create_location",
      sceneTitle: "Hook",
      prompt: "portrait opening",
      status: "planned",
      aspectRatio: "9:16",
    } as RunnerTask);
    expect(portraitImage.payload).toMatchObject({
      aspect_ratio: "9:16",
    });
    expect(portraitImage.payload).not.toHaveProperty("size");

    expect(buildWaveSpeedPayload({
      id: "image-2",
      tool: "create_location",
      sceneTitle: "Hook",
      prompt: "premium still",
      status: "planned",
    }).modelId).toBe("google/nano-banana/text-to-image");

    const imageEdit = buildWaveSpeedPayload(
      {
        id: "edit-1",
        tool: "image_to_image",
        sceneTitle: "Hook",
      prompt: "keep subject, change scene",
      status: "planned",
      referenceUrl: "https://cdn.example/reference.png",
      aspectRatio: "1:1",
    },
      ["https://cdn.example/reference.png", "https://cdn.example/scene.png"],
    );
    expect(imageEdit.modelId).toBe("google/nano-banana/text-to-image");
    expect(imageEdit.payload).toMatchObject({
      image: "https://cdn.example/reference.png",
      images: ["https://cdn.example/reference.png", "https://cdn.example/scene.png"],
      prompt: "keep subject, change scene",
      aspect_ratio: "1:1",
      output_format: "png",
      enable_base64_output: false,
    });
    expect(imageEdit.payload).not.toHaveProperty("size");

    const music = buildWaveSpeedPayload({
      id: "music-1",
      tool: "text_to_bgm",
      sceneTitle: "Hook",
      prompt: "warm instrumental pulse",
      status: "planned",
    });
    expect(music.modelId).toBe("local-bgm");
    expect(music.payload).toMatchObject({
      prompt: "warm instrumental pulse",
    });

    const tts = buildWaveSpeedPayload({
      id: "voice-1",
      tool: "tts_create",
      sceneTitle: "Hook",
      prompt: "Hello there",
      status: "planned",
      voiceId: "Calm_Woman",
      emotion: "happy",
      speed: 1.1,
      pitch: 0,
      volume: 1,
    });
    expect(tts.modelId).toBe("edge-tts");
    expect(tts.payload).toMatchObject({
      text: "Hello there",
      voice_id: "Calm_Woman",
      speed: 1.1,
    });
    expect(tts.payload).not.toHaveProperty("emotion");
  });

  it("polls Wavespeed until a succeeded prediction returns outputs", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { id: "pred-1", model: "model-a", status: "processing", urls: { get: "https://api.example/result" } } }))
      .mockResolvedValueOnce(jsonResponse({ code: 200, data: { id: "pred-1", model: "model-a", status: "succeeded", outputs: ["https://cdn.example/out.png"] } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runWaveSpeedPrediction("wavespeed-ai/model-a", { prompt: "hello" }, { pollIntervalMs: 1, timeoutMs: 1000 });

    expect(result).toMatchObject({ outputs: ["https://cdn.example/out.png"] });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.wavespeed.ai/api/v3/wavespeed-ai/model-a",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.example/result",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer test-key" }) }),
    );
  });

  it("executes dependent runner tasks and persists generated assets", async () => {
    const requests: Array<{ url: string; body?: unknown }> = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (init?.method === "POST" && url.includes("text-to-image")) {
        return jsonResponse({ code: 200, data: { id: "pred-image", model: "image", status: "processing", urls: { get: "https://api.example/image-result" } } });
      }
      if (url === "https://api.example/image-result") {
        return jsonResponse({ code: 200, data: { id: "pred-image", model: "image", status: "completed", outputs: ["https://cdn.example/image.png"] } });
      }
      throw new Error(`Unexpected fetch call: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    mockPrisma.toolCall.create.mockResolvedValueOnce({ id: "tool-image" }).mockResolvedValueOnce({ id: "tool-tts" });
    mockPrisma.asset.create.mockResolvedValueOnce({ id: "asset-image" }).mockResolvedValueOnce({ id: "asset-tts" });

    const tasks: RunnerTask[] = [
      { id: "task-image", tool: "create_location", sceneTitle: "Hook", prompt: "frame", status: "planned" },
      { id: "task-tts", tool: "tts_create", sceneTitle: "Hook", prompt: "hello", status: "planned", dependsOn: "task-image" },
    ];

    const assets = await executeRunnerTasks({
      threadId: "thread-1",
      userId: "user-1",
      recipeId: "recipe-1",
      tasks,
      blocks: [{ id: "block-1", title: "Hook" }],
    });

    expect(assets).toEqual([
      expect.objectContaining({ taskId: "task-image", assetId: "asset-image", url: "https://cdn.example/image.png", type: "image" }),
      expect.objectContaining({ taskId: "task-tts", assetId: "asset-tts", url: "https://cdn.example/voice.mp3", type: "audio" }),
    ]);
    expect(mockPrisma.toolCall.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "tool-image" }, data: expect.objectContaining({ status: "COMPLETED" }) }));
    expect(mockPrisma.toolCall.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "tool-tts" }, data: expect.objectContaining({ status: "COMPLETED" }) }));
    expect(mockPrisma.agentState.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ currentStep: "media_completed" }) }));
  });

  it("submits independent runner tasks in parallel before polling results", async () => {
    process.env.WAVESPEED_RUNNER_CONCURRENCY = "2";
    const requests: Array<{ url: string; body?: unknown }> = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (init?.method === "POST") {
        const id = url.includes("first") ? "pred-first" : "pred-second";
        return jsonResponse({ code: 200, data: { id, model: "image", status: "processing", urls: { get: `https://api.example/${id}` } } });
      }
      return jsonResponse({
        code: 200,
        data: {
          id: url.split("/").pop(),
          model: "image",
          status: "completed",
          outputs: [`https://cdn.example/${url.split("/").pop()}.png`],
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    mockPrisma.toolCall.create.mockResolvedValueOnce({ id: "tool-first" }).mockResolvedValueOnce({ id: "tool-second" });
    mockPrisma.asset.create.mockResolvedValueOnce({ id: "asset-first" }).mockResolvedValueOnce({ id: "asset-second" });

    await executeRunnerTasks({
      threadId: "thread-1",
      userId: "user-1",
      recipeId: "recipe-1",
      tasks: [
        { id: "first", tool: "create_location", sceneTitle: "First", prompt: "first", status: "planned" },
        { id: "second", tool: "create_location", sceneTitle: "Second", prompt: "second", status: "planned" },
      ],
      blocks: [],
    });

    expect(requests.slice(0, 2).map((request) => request.body)).toEqual([
      expect.objectContaining({ prompt: expect.stringContaining("first") }),
      expect.objectContaining({ prompt: expect.stringContaining("second") }),
    ]);
  });

  it("reports runner task status changes while executing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mockPrisma.toolCall.create.mockResolvedValueOnce({ id: "tool-voice" });
    mockPrisma.asset.create.mockResolvedValueOnce({ id: "asset-voice" });
    const events: Array<{ status: string; taskId: string; assetId?: string }> = [];

    await executeRunnerTasks({
      threadId: "thread-1",
      userId: "user-1",
      recipeId: "recipe-1",
      tasks: [
        { id: "voice-1", tool: "tts_create", sceneTitle: "Hook", prompt: "hello", status: "planned" },
      ],
      blocks: [{ id: "block-1", title: "Hook" }],
      onTaskStatus: (event) => events.push({
        status: event.status,
        taskId: event.task.id,
        assetId: event.asset?.assetId,
      }),
    });

    expect(events).toEqual([
      { status: "running", taskId: "voice-1" },
      { status: "completed", taskId: "voice-1", assetId: "asset-voice" },
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("persists Edge TTS metadata without remote TTS model duration", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mockPrisma.toolCall.create.mockResolvedValueOnce({ id: "tool-voice" });
    mockPrisma.asset.create.mockResolvedValueOnce({ id: "asset-voice" });

    await executeRunnerTasks({
      threadId: "thread-1",
      userId: "user-1",
      recipeId: "recipe-1",
      tasks: [
        { id: "voice-1", tool: "tts_create", sceneTitle: "Hook", prompt: "hello", status: "planned" },
      ],
      blocks: [{ id: "block-1", title: "Hook" }],
    });

    expect(mockPrisma.asset.create.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          provider: "wavespeed",
          outputs: ["https://cdn.example/voice.mp3"],
        }),
      }),
    }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
