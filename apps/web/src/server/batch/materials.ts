import fs from "node:fs/promises";
import path from "node:path";

export type VideoMaterial = {
  provider: "local" | "pexels" | "pixabay";
  url: string;
  duration: number;
};

export type MaterialSource = "local" | "pexels" | "pixabay";

export function chooseMaterialProvider(source: MaterialSource): VideoMaterial["provider"][] {
  if (source === "local") return ["local"];
  return [source];
}

function targetWidth(aspectRatio: string) {
  if (aspectRatio === "9:16") return 1080;
  if (aspectRatio === "1:1") return 1080;
  return 1920;
}

export function parsePexelsVideos(body: unknown, aspectRatio: string, minDuration: number): VideoMaterial[] {
  const videos = Array.isArray((body as any)?.videos) ? (body as any).videos : [];
  const expected =
    aspectRatio === "9:16"
      ? { width: 1080, height: 1920 }
      : aspectRatio === "1:1"
        ? { width: 1080, height: 1080 }
        : { width: 1920, height: 1080 };

  return videos.flatMap((video: any) => {
    const duration = Number(video?.duration || 0);
    if (duration < minDuration) return [];
    const files = Array.isArray(video?.video_files) ? video.video_files : [];
    const match =
      files.find((file: any) => Number(file?.width) === expected.width && Number(file?.height) === expected.height) ??
      files[0];
    return match?.link ? [{ provider: "pexels" as const, url: String(match.link), duration }] : [];
  });
}

export function parsePixabayVideos(body: unknown, aspectRatio: string, minDuration: number): VideoMaterial[] {
  const hits = Array.isArray((body as any)?.hits) ? (body as any).hits : [];
  const minWidth = targetWidth(aspectRatio);

  return hits.flatMap((hit: any) => {
    const duration = Number(hit?.duration || 0);
    if (duration < minDuration) return [];
    const videos = hit?.videos && typeof hit.videos === "object" ? Object.values(hit.videos) : [];
    const match = (videos.find((video: any) => Number(video?.width || 0) >= minWidth) ?? videos[0]) as any;
    return match?.url ? [{ provider: "pixabay" as const, url: String(match.url), duration }] : [];
  });
}

export async function listLocalVideos(directory: string): Promise<VideoMaterial[]> {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && /\.(mp4|mov|webm|mkv)$/i.test(entry.name))
      .map((entry) => ({ provider: "local" as const, url: path.resolve(directory, entry.name), duration: 0 }));
  } catch {
    return [];
  }
}

export async function searchPexelsVideos(
  query: string,
  aspectRatio: string,
  minDuration: number,
): Promise<VideoMaterial[]> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) throw new Error("PEXELS_API_KEY is required for Pexels video search.");

  const orientation = aspectRatio === "9:16" ? "portrait" : aspectRatio === "16:9" ? "landscape" : "square";
  const url = new URL("https://api.pexels.com/videos/search");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "20");
  url.searchParams.set("orientation", orientation);

  const response = await fetch(url, { headers: { Authorization: apiKey } });
  if (!response.ok) throw new Error(`Pexels search failed: ${response.status}`);
  return parsePexelsVideos(await response.json(), aspectRatio, minDuration);
}

export async function searchPixabayVideos(
  query: string,
  aspectRatio: string,
  minDuration: number,
): Promise<VideoMaterial[]> {
  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) throw new Error("PIXABAY_API_KEY is required for Pixabay video search.");

  const url = new URL("https://pixabay.com/api/videos/");
  url.searchParams.set("q", query);
  url.searchParams.set("video_type", "all");
  url.searchParams.set("per_page", "50");
  url.searchParams.set("key", apiKey);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Pixabay search failed: ${response.status}`);
  return parsePixabayVideos(await response.json(), aspectRatio, minDuration);
}
