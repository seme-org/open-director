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

function aihubmixBaseUrl() {
  return env("AIHUBMIX_API_BASE_URL", "https://aihubmix.com").replace(/\/$/, "");
}

function aihubmixHeaders() {
  const apiKey = env("AIHUBMIX_API_KEY");
  if (!apiKey) {
    throw new Error("AIHUBMIX_API_KEY is required to execute media generation.");
  }
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

function aspectRatioToSize(aspectRatio: AspectRatio = "16:9"): string {
  if (aspectRatio === "9:16") return "768x1344";
  if (aspectRatio === "1:1") return "1024x1024";
  return "1344x768";
}

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { message: text };
  }
}

async function generateImageViaOpenAI(prompt: string, size: string): Promise<MediaGenerationResult> {
  const model = env("AIHUBMIX_IMAGE_MODEL", "doubao-seedream-4-0");

  if (model.includes("gemini")) {
    return generateImageViaGemini(prompt, model);
  }

  const response = await fetch(`${aihubmixBaseUrl()}/v1/images/generations`, {
    method: "POST",
    headers: aihubmixHeaders(),
    body: JSON.stringify({ model, prompt, n: 1, size }),
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(`AiHubMix image generation failed: ${JSON.stringify(body).slice(0, 1000)}`);
  }
  const url = body?.data?.[0]?.url;
  if (!url) {
    throw new Error(`AiHubMix image generation returned no URL: ${JSON.stringify(body).slice(0, 1000)}`);
  }
  return { outputs: [url], raw: body };
}

async function generateImageViaGemini(prompt: string, model: string): Promise<MediaGenerationResult> {
  const aspectRatio = env("AIHUBMIX_IMAGE_ASPECT_RATIO", "16:9");
  const response = await fetch(`${aihubmixBaseUrl()}/v1/chat/completions`, {
    method: "POST",
    headers: aihubmixHeaders(),
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: `aspect_ratio=${aspectRatio}` },
        { role: "user", content: [{ type: "text", text: prompt }] },
      ],
      modalities: ["text", "image"],
    }),
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(`AiHubMix Gemini image generation failed: ${JSON.stringify(body).slice(0, 1000)}`);
  }

  const parts = body?.choices?.[0]?.message?.multi_mod_content;
  if (!parts || !Array.isArray(parts)) {
    throw new Error(`AiHubMix Gemini image returned no content: ${JSON.stringify(body).slice(0, 1000)}`);
  }

  for (const part of parts) {
    if (part.inline_data?.data) {
      const buffer = Buffer.from(part.inline_data.data, "base64");
      const ext = part.inline_data.mime_type?.includes("jpeg") ? "jpg" : "png";
      const objectKey = `media/image/${randomUUID()}.${ext}`;
      const result = await minioStorage.putObject({
        objectKey,
        body: buffer,
        contentType: part.inline_data.mime_type || "image/png",
      });
      return { outputs: [result.publicUrl], raw: body };
    }
  }

  throw new Error(`AiHubMix Gemini image: no image data in response`);
}

async function generateImageEditViaOpenAI(
  prompt: string,
  imageUrl: string,
  size: string,
): Promise<MediaGenerationResult> {
  const model = env("AIHUBMIX_IMAGE_EDIT_MODEL", "qwen-image-edit-plus");
  const response = await fetch(`${aihubmixBaseUrl()}/v1/images/edits`, {
    method: "POST",
    headers: aihubmixHeaders(),
    body: JSON.stringify({ model, prompt, image: imageUrl, n: 1, size }),
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(`AiHubMix image edit failed: ${JSON.stringify(body).slice(0, 1000)}`);
  }
  const url = body?.data?.[0]?.url;
  if (!url) {
    throw new Error(`AiHubMix image edit returned no URL: ${JSON.stringify(body).slice(0, 1000)}`);
  }
  return { outputs: [url], raw: body };
}

const TTS_VOICE_MAP: Record<string, string> = {
  "zh-CN-XiaoxiaoNeural": "nova",
  "zh-CN-YunxiNeural": "onyx",
  "zh-CN-XiaoyiNeural": "shimmer",
  "zh-CN-YunjianNeural": "onyx",
  "zh-CN-XiaochenNeural": "nova",
  "zh-CN-YunyangNeural": "echo",
  "zh-CN-XiaoxuanNeural": "shimmer",
  "zh-CN-YunzeNeural": "onyx",
  "en-US-JennyNeural": "nova",
  "en-US-GuyNeural": "onyx",
};

function resolveTtsVoice(voiceId?: string): string {
  const defaultVoice = env("AIHUBMIX_TTS_VOICE", "nova");
  if (!voiceId) return defaultVoice;
  return TTS_VOICE_MAP[voiceId] || voiceId.toLowerCase() || defaultVoice;
}

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

async function generateTTS(text: string, options: {
  voiceId?: string;
  emotion?: string;
  speed?: number;
  pitch?: number;
  volume?: number;
}): Promise<MediaGenerationResult> {
  const model = env("AIHUBMIX_TTS_MODEL", "tts-1-hd");

  if (model === "edge") {
    return generateEdgeTTS(text, options);
  }

  const voice = resolveTtsVoice(options.voiceId);
  const instructions = options.emotion
    ? `Speak with a ${options.emotion} tone.`
    : undefined;

  const body: Record<string, unknown> = {
    model,
    input: text,
    voice,
    response_format: "mp3",
  };
  if (instructions) body.instructions = instructions;

  const response = await fetch(`${aihubmixBaseUrl()}/v1/audio/speech`, {
    method: "POST",
    headers: aihubmixHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await readJson(response);
    throw new Error(`AiHubMix TTS failed: ${JSON.stringify(errorBody).slice(0, 1000)}`);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  const objectKey = `media/tts/${randomUUID()}.mp3`;
  const result = await minioStorage.putObject({
    objectKey,
    body: audioBuffer,
    contentType: "audio/mpeg",
  });

  return { outputs: [result.publicUrl], raw: { model, voice } };
}

export function createAiHubMixProvider(): MediaProvider {
  return {
    async generateImage(prompt, options) {
      const size = aspectRatioToSize(options.aspectRatio);
      return generateImageViaOpenAI(prompt, size);
    },

    async generateImageWithReference(prompt, referenceUrls, options) {
      const size = aspectRatioToSize(options.aspectRatio);
      if (referenceUrls.length === 1) {
        return generateImageEditViaOpenAI(prompt, referenceUrls[0], size);
      }
      return generateImageViaOpenAI(prompt, size);
    },

    async generateTTS(text, options) {
      return generateTTS(text, options);
    },

    async generateBGM(prompt) {
      const bgmUrl = await uploadLocalBgm(prompt);
      return { outputs: [bgmUrl], raw: { source: "local" } };
    },
  };
}
