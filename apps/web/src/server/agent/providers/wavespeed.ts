import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { EdgeTTS } from "node-edge-tts";
import type { AspectRatio, MediaGenerationResult, MediaProvider } from "../media-provider";
import { minioStorage } from "@/server/storage/minio";
import { uploadLocalBgm } from "./local-bgm";

function env(name: string, fallback = "") {
  return process.env[name] || fallback;
}

function aspectSize(aspectRatio: AspectRatio = "16:9") {
  if (aspectRatio === "9:16") return "720*1280";
  if (aspectRatio === "1:1") return "1024*1024";
  return "1280*720";
}

function resolveWaveSpeedModelId(modelId: string) {
  const aliases: Record<string, string> = {
    "nano-banana": "google/nano-banana/text-to-image",
  };
  return aliases[modelId] ?? modelId;
}

function nanoBananaModelId() {
  // Image generation is intentionally pinned for consistent text-to-image and reference-image results.
  return resolveWaveSpeedModelId("nano-banana");
}

function wavespeedBaseUrl() {
  return env("WAVESPEED_API_BASE_URL", "https://api.wavespeed.ai/api/v3").replace(/\/$/, "");
}

function wavespeedHeaders() {
  const apiKey = env("WAVESPEED_API_KEY");
  if (!apiKey) {
    throw new Error("WAVESPEED_API_KEY is required to execute media generation.");
  }
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

function normalizeWaveSpeedStatus(status: string) {
  if (status === "completed" || status === "succeeded") return "completed";
  if (status === "failed") return "failed";
  return "processing";
}

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { message: text };
  }
}

type WaveSpeedPrediction = {
  id: string;
  model: string;
  status: "created" | "processing" | "completed" | "succeeded" | "failed" | string;
  outputs?: string[];
  urls?: { get?: string };
  error?: string;
};

async function submitTask(modelId: string, payload: Record<string, unknown>) {
  const response = await fetch(`${wavespeedBaseUrl()}/${modelId}`, {
    method: "POST",
    headers: wavespeedHeaders(),
    body: JSON.stringify(payload),
  });
  const body = await readJson(response);
  if (!response.ok || body?.code >= 400) {
    throw new Error(`WaveSpeed submit failed for ${modelId}: ${JSON.stringify(body).slice(0, 1000)}`);
  }
  const prediction = body?.data as WaveSpeedPrediction | undefined;
  if (!prediction?.id) {
    throw new Error(`WaveSpeed submit response did not include a prediction id: ${JSON.stringify(body).slice(0, 1000)}`);
  }
  return prediction;
}

async function fetchPrediction(prediction: WaveSpeedPrediction) {
  const resultUrl = prediction.urls?.get || `${wavespeedBaseUrl()}/predictions/${prediction.id}/result`;
  const response = await fetch(resultUrl, {
    headers: wavespeedHeaders(),
  });
  const body = await readJson(response);
  if (!response.ok || body?.code >= 400) {
    throw new Error(`WaveSpeed fetch failed for ${prediction.id}: ${JSON.stringify(body).slice(0, 1000)}`);
  }
  return body?.data as WaveSpeedPrediction;
}

async function runPrediction(
  modelId: string,
  payload: Record<string, unknown>,
  options: { pollIntervalMs?: number; timeoutMs?: number } = {},
): Promise<MediaGenerationResult> {
  const prediction = await submitTask(modelId, payload);
  const deadline = Date.now() + (options.timeoutMs ?? Number(env("WAVESPEED_TIMEOUT_MS", "600000")));
  const pollIntervalMs = options.pollIntervalMs ?? Number(env("WAVESPEED_POLL_INTERVAL_MS", "2000"));

  let latest = prediction;
  while (Date.now() <= deadline) {
    const currentStatus = normalizeWaveSpeedStatus(latest.status);
    latest = currentStatus === "completed" || currentStatus === "failed" ? latest : await fetchPrediction(latest);
    const latestStatus = normalizeWaveSpeedStatus(latest.status);
    if (latestStatus === "completed") {
      const outputs = Array.isArray(latest.outputs) ? latest.outputs.filter(Boolean) : [];
      if (!outputs.length) {
        throw new Error(`WaveSpeed prediction ${latest.id} completed without outputs.`);
      }
      return { outputs, raw: latest };
    }
    if (latestStatus === "failed") {
      throw new Error(`WaveSpeed prediction ${latest.id} failed: ${latest.error || "unknown error"}`);
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`WaveSpeed prediction ${prediction.id} timed out.`);
}

function buildImagePayload(modelId: string, prompt: string, aspectRatio: AspectRatio) {
  if (modelId.startsWith("google/nano-banana")) {
    return {
      prompt,
      aspect_ratio: aspectRatio,
      output_format: env("WAVESPEED_IMAGE_OUTPUT_FORMAT", "png"),
      enable_sync_mode: false,
      enable_base64_output: false,
    };
  }

  return {
    prompt,
    aspect_ratio: aspectRatio,
    size: aspectSize(aspectRatio),
    num_inference_steps: Number(env("WAVESPEED_IMAGE_STEPS", "28")),
    guidance_scale: Number(env("WAVESPEED_IMAGE_GUIDANCE_SCALE", "3.5")),
    num_images: 1,
    enable_base64_output: false,
    enable_safety_checker: true,
    seed: -1,
  };
}

export function buildWaveSpeedPayload(task: { tool: string; prompt: string; aspectRatio?: AspectRatio; voiceId?: string; emotion?: string; speed?: number; pitch?: number; volume?: number; [key: string]: unknown }, dependencyUrls: string[] = []) {
  if (task.tool === "create_character" || task.tool === "create_location") {
    const modelId = nanoBananaModelId();
    const aspectRatio = task.aspectRatio || "16:9";
    return { modelId, payload: buildImagePayload(modelId, task.prompt, aspectRatio) };
  }

  if (task.tool === "image_to_image") {
    const [primaryImage] = dependencyUrls;
    const aspectRatio = task.aspectRatio || "16:9";
    const modelId = nanoBananaModelId();
    return {
      modelId,
      payload: {
        image: primaryImage,
        images: dependencyUrls,
        prompt: task.prompt,
        aspect_ratio: aspectRatio,
        output_format: env("WAVESPEED_IMAGE_OUTPUT_FORMAT", "png"),
        enable_base64_output: false,
      },
    };
  }

  if (task.tool === "tts_create") {
    return {
      modelId: "edge-tts",
      payload: {
        text: task.prompt,
        voice_id: task.voiceId || env("EDGE_TTS_VOICE", "zh-CN-XiaoxiaoNeural"),
        speed: task.speed,
      },
    };
  }

  return {
    modelId: "local-bgm",
    payload: {
      prompt: task.prompt || "instrumental",
    },
  };
}

export { runPrediction as runWaveSpeedPrediction };

function edgeTtsProxy() {
  return env("BATCH_EDGE_TTS_PROXY") || env("HTTPS_PROXY") || env("HTTP_PROXY") || "";
}

const EDGE_TTS_VOICE_MAP: Record<string, string> = {
  "zh-CN-XiaoxiaoNeural": "zh-CN-XiaoxiaoNeural",
  "zh-CN-YunxiNeural": "zh-CN-YunxiNeural",
  "zh-CN-XiaoyiNeural": "zh-CN-XiaoyiNeural",
  "zh-CN-YunjianNeural": "zh-CN-YunjianNeural",
  "zh-CN-XiaochenNeural": "zh-CN-XiaochenNeural",
  "zh-CN-YunyangNeural": "zh-CN-YunyangNeural",
  "zh-CN-XiaoxuanNeural": "zh-CN-XiaoxuanNeural",
  "zh-CN-YunzeNeural": "zh-CN-YunzeNeural",
  "en-US-JennyNeural": "en-US-JennyNeural",
  "en-US-GuyNeural": "en-US-GuyNeural",
};

function resolveEdgeTtsVoice(voiceId?: string): string {
  const defaultVoice = env("EDGE_TTS_VOICE", "zh-CN-XiaoxiaoNeural");
  if (!voiceId) return defaultVoice;
  return EDGE_TTS_VOICE_MAP[voiceId] || voiceId || defaultVoice;
}

async function generateEdgeTTS(text: string, options: {
  voiceId?: string;
  speed?: number;
}): Promise<MediaGenerationResult> {
  if (!text || !text.trim()) {
    throw new Error("Edge TTS: text is empty");
  }

  const tmpDir = path.join(process.cwd(), ".tmp", "edge-tts");
  await fs.mkdir(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, `${randomUUID()}.mp3`);

  const voice = resolveEdgeTtsVoice(options.voiceId);
  const rate = options.speed ? `${Math.round((options.speed - 1) * 100)}%` : "+0%";
  const proxy = edgeTtsProxy();

  const ttsOptions: Record<string, unknown> = {
    voice,
    rate,
    timeout: 30000,
  };
  if (proxy) ttsOptions.proxy = proxy;

  try {
    const tts = new EdgeTTS(ttsOptions);
    await tts.ttsPromise(text, filePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Edge TTS failed: ${message}${proxy ? ` (proxy: ${proxy})` : ""}`);
  }

  const audioBuffer = await fs.readFile(filePath);
  const objectKey = `media/tts/${randomUUID()}.mp3`;
  const result = await minioStorage.putObject({
    objectKey,
    body: audioBuffer,
    contentType: "audio/mpeg",
  });

  await fs.unlink(filePath).catch(() => {});

  return { outputs: [result.publicUrl], raw: { provider: "edge-tts", voice } };
}

export function createWaveSpeedProvider(): MediaProvider {
  return {
    async generateImage(prompt, options) {
      const modelId = nanoBananaModelId();
      const payload = buildImagePayload(modelId, prompt, options.aspectRatio || "16:9");
      return runPrediction(modelId, payload);
    },

    async generateImageWithReference(prompt, referenceUrls, options) {
      const [primaryImage] = referenceUrls;
      const aspectRatio = options.aspectRatio || "16:9";
      const modelId = nanoBananaModelId();
      const payload = {
        image: primaryImage,
        images: referenceUrls,
        prompt,
        aspect_ratio: aspectRatio,
        output_format: env("WAVESPEED_IMAGE_OUTPUT_FORMAT", "png"),
        enable_base64_output: false,
      };
      return runPrediction(modelId, payload);
    },

    async generateTTS(text, options) {
      return generateEdgeTTS(text, options);
    },

    async generateBGM(prompt) {
      const bgmUrl = await uploadLocalBgm(prompt);
      return { outputs: [bgmUrl], raw: { source: "local" } };
    },
  };
}
