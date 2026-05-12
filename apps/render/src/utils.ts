import crypto from "node:crypto";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import fs from "fs-extra";
import ffmpeg from "fluent-ffmpeg";
import { HttpsProxyAgent } from "https-proxy-agent";
import { config } from "./config.js";

const inflightDownloads = new Map<string, Promise<string>>();
const DOWNLOAD_RETRY_ATTEMPTS = 3;
const DOWNLOAD_RETRY_DELAY_MS = 750;
export const DOWNLOAD_TIMEOUT_MS = 240_000;

function getExtFromContentType(contentType: string | undefined): string {
  if (!contentType) return "";
  const map: Record<string, string> = {
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "audio/ogg": ".ogg",
  };
  return map[contentType.toLowerCase().split(";")[0].trim()] || "";
}

function getExtFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname);
    if (ext && ext.length <= 6) return ext;
  } catch {}
  return "";
}

export function getStableDownloadFileName(
  url: string,
  contentType?: string,
): string {
  const hash = crypto.createHash("sha1").update(url).digest("hex").slice(0, 16);
  const ext = getExtFromUrl(url) || getExtFromContentType(contentType) || "";
  return `${hash}${ext}`;
}

function isLocalDownloadUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

function isInternalStorageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const endpoint = new URL(config.s3.endpoint);
    const publicEndpoint = new URL(config.s3.publicEndpoint);

    return (
      parsed.hostname === endpoint.hostname ||
      parsed.hostname === publicEndpoint.hostname ||
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "::1"
    );
  } catch {
    return false;
  }
}

export function resolveDownloadUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const endpoint = new URL(config.s3.endpoint);
    const isLocalMinioUrl =
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") &&
      parsed.port === "9000" &&
      endpoint.hostname !== parsed.hostname;

    if (!isLocalMinioUrl) return url;

    parsed.protocol = endpoint.protocol;
    parsed.hostname = endpoint.hostname;
    parsed.port = endpoint.port;
    return parsed.toString();
  } catch {
    return url;
  }
}

export function getDownloadProxy(url: string): string {
  if (isLocalDownloadUrl(url) || isInternalStorageUrl(url)) return "";
  return (
    process.env.RENDER_DOWNLOAD_PROXY ||
    process.env.BATCH_EDGE_TTS_PROXY ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    ""
  );
}

function downloadWithNodeHttp(url: string, proxy: string): Promise<{ buffer: Buffer; contentType?: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === "http:" ? http : https;
    const request = client.get(
      url,
      {
        agent: proxy ? new HttpsProxyAgent(proxy) : undefined,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
        },
      },
      (response) => {
        const statusCode = response.statusCode || 0;
        if (statusCode < 200 || statusCode >= 300) {
          response.resume();
          reject(new Error(`Download failed: ${statusCode} ${response.statusMessage || ""}`.trim()));
          return;
        }

        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => {
          const contentType = Array.isArray(response.headers["content-type"])
            ? response.headers["content-type"][0]
            : response.headers["content-type"];
          resolve({ buffer: Buffer.concat(chunks), contentType });
        });
      },
    );

    request.setTimeout(DOWNLOAD_TIMEOUT_MS, () => request.destroy(new Error("Download timed out.")));
    request.on("error", reject);
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetriableDownloadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /socket hang up/i.test(message) ||
    /network socket disconnected/i.test(message) ||
    /ECONNRESET/i.test(message) ||
    /ETIMEDOUT/i.test(message) ||
    /EAI_AGAIN/i.test(message) ||
    /Download timed out/i.test(message)
  );
}

async function withDownloadRetries<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= DOWNLOAD_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= DOWNLOAD_RETRY_ATTEMPTS || !isRetriableDownloadError(error)) {
        throw error;
      }
      await sleep(DOWNLOAD_RETRY_DELAY_MS * attempt);
    }
  }
  throw lastError;
}

async function downloadUrl(url: string): Promise<{ buffer: Buffer; contentType?: string }> {
  return await withDownloadRetries(async () => {
    const proxy = getDownloadProxy(url);
    if (proxy) return await downloadWithNodeHttp(url, proxy);

    const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get("content-type") || undefined,
    };
  });
}

export function probeMedia(filePath: string): Promise<ffmpeg.FfprobeData> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata);
    });
  });
}

export function processAudioSpeed(
  input: string,
  output: string,
  speed: number,
): Promise<void> {
  if (Math.abs(speed - 1) < 0.01) {
    return fs.copy(input, output);
  }

  return new Promise((resolve, reject) => {
    const filters: string[] = [];
    let remaining = speed;

    if (speed > 1) {
      while (remaining > 2.0) {
        filters.push("atempo=2.0");
        remaining /= 2.0;
      }
      filters.push(`atempo=${remaining.toFixed(4)}`);
    } else {
      while (remaining < 0.5) {
        filters.push("atempo=0.5");
        remaining /= 0.5;
      }
      filters.push(`atempo=${remaining.toFixed(4)}`);
    }

    ffmpeg(input)
      .audioFilters(filters.join(","))
      .outputOptions(["-y"])
      .save(output)
      .on("end", () => resolve())
      .on("error", (err) => reject(err));
  });
}

export async function downloadFile(url: string, destDir: string): Promise<string> {
  const existing = inflightDownloads.get(url);
  if (existing) return existing;

  const promise = (async () => {
    const fileName = getStableDownloadFileName(url);
    const filePath = path.join(destDir, fileName);

    if ((await fs.pathExists(filePath)) && (await fs.stat(filePath)).size > 0) {
      return filePath;
    }

    const { buffer } = await downloadUrl(resolveDownloadUrl(url));
    await fs.outputFile(filePath, buffer);
    return filePath;
  })();

  inflightDownloads.set(url, promise);
  try {
    return await promise;
  } finally {
    inflightDownloads.delete(url);
  }
}
