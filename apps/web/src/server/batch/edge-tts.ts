import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { EdgeTTS } from "node-edge-tts";

export function normalizeEdgeRate(rate: number) {
  const percent = Math.round((rate - 1) * 100);
  return `${percent >= 0 ? "+" : ""}${percent}%`;
}

export function subtitleTextFromScript(script: string) {
  return script
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

export function buildEdgeTtsOptions(input: {
  script: string;
  voice: string;
  rate: number;
  proxy?: string;
}) {
  return {
    voice: input.voice,
    rate: normalizeEdgeRate(input.rate),
    saveSubtitles: true,
    timeout: 30000,
    ...(input.proxy ? { proxy: input.proxy } : {}),
  };
}

export function edgeSubtitleDurationSeconds(value: unknown) {
  const entries = Array.isArray(value) ? value : [];
  const lastEnd = entries.reduce((max, entry) => {
    const end = Number((entry as { end?: unknown }).end ?? 0);
    return Number.isFinite(end) ? Math.max(max, end) : max;
  }, 0);
  return Math.round((lastEnd / 1000) * 1000) / 1000;
}

export type SubtitleTiming = {
  text: string;
  start: number;
  end: number;
};

export function parseSubtitleTimings(value: unknown): SubtitleTiming[] {
  const entries = Array.isArray(value) ? value : [];

  return entries.map((entry: any) => {
    // Edge TTS format: { part: "text", start: 100, end: 400 } (milliseconds)
    const text = String(entry?.part || entry?.text || entry?.content || "");
    const start = Number(entry?.start || entry?.offset || 0);
    const end = Number(entry?.end || start + Number(entry?.duration || 0));

    return {
      text,
      start,  // already in milliseconds
      end,    // already in milliseconds
    };
  });
}

function edgeTtsProxy() {
  return process.env.BATCH_EDGE_TTS_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || "";
}

function edgeTtsFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return `Edge TTS request failed. The npm library is installed, but Microsoft Edge TTS rejected or blocked the request. ${message} Set BATCH_EDGE_TTS_PROXY if this network needs a proxy.`;
}

export async function createEdgeTtsAudio(input: {
  script: string;
  voice: string;
  rate: number;
  outputDir: string;
}) {
  await fs.mkdir(input.outputDir, { recursive: true });
  const filePath = path.join(input.outputDir, `${randomUUID()}.mp3`);
  try {
    const tts = new EdgeTTS(buildEdgeTtsOptions({ ...input, proxy: edgeTtsProxy() }));
    await tts.ttsPromise(input.script, filePath);
  } catch (error) {
    throw new Error(edgeTtsFailureMessage(error));
  }
  const subtitleFilePath = `${filePath}.json`;
  let duration: number | undefined;
  let subtitleTimings: SubtitleTiming[] = [];
  try {
    const content = await fs.readFile(subtitleFilePath, "utf8");
    const parsed = JSON.parse(content);
    duration = edgeSubtitleDurationSeconds(parsed);
    subtitleTimings = parseSubtitleTimings(parsed);
  } catch {
    // Ignore if subtitle file doesn't exist
  }
  return {
    path: filePath,
    subtitleText: subtitleTextFromScript(input.script),
    duration,
    subtitleTimings,
  };
}
