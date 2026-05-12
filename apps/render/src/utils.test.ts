import { describe, expect, it } from "vitest";
import { config } from "./config.js";
import {
  getDownloadProxy,
  getStableDownloadFileName,
  isRetriableDownloadError,
  resolveDownloadUrl,
} from "./utils.js";

describe("getStableDownloadFileName", () => {
  it("produces a deterministic filename from the same url", () => {
    const a = getStableDownloadFileName("https://cdn.example.com/video.mp4");
    const b = getStableDownloadFileName("https://cdn.example.com/video.mp4");
    expect(a).toBe(b);
  });

  it("extracts extension from url pathname", () => {
    const name = getStableDownloadFileName("https://cdn.example.com/image.png");
    expect(name).toMatch(/\.png$/);
  });

  it("falls back to content-type when url has no extension", () => {
    const name = getStableDownloadFileName(
      "https://cdn.example.com/asset/12345",
      "image/jpeg",
    );
    expect(name).toMatch(/\.jpg$/);
  });

  it("strips charset from content-type before mapping", () => {
    const name = getStableDownloadFileName(
      "https://cdn.example.com/asset/999",
      "video/mp4; charset=utf-8",
    );
    expect(name).toMatch(/\.mp4$/);
  });

  it("returns no extension when neither url nor content-type provides one", () => {
    const name = getStableDownloadFileName(
      "https://cdn.example.com/asset/abc",
      "application/octet-stream",
    );
    expect(name).not.toMatch(/\.[a-z0-9]{1,6}$/);
  });

  it("produces different filenames for different urls", () => {
    const a = getStableDownloadFileName("https://cdn.example.com/a.mp4");
    const b = getStableDownloadFileName("https://cdn.example.com/b.mp4");
    expect(a).not.toBe(b);
  });

  it("uses a 16-character hex prefix", () => {
    const name = getStableDownloadFileName("https://cdn.example.com/test.mp4");
    const prefix = name.replace(/\.[^.]+$/, "");
    expect(prefix).toMatch(/^[0-9a-f]{16}$/);
  });

  it("uses render download proxy for remote urls", () => {
    const previous = process.env.RENDER_DOWNLOAD_PROXY;
    process.env.RENDER_DOWNLOAD_PROXY = "http://127.0.0.1:7897";
    expect(getDownloadProxy("https://videos.pexels.com/video.mp4")).toBe("http://127.0.0.1:7897");
    if (previous === undefined) delete process.env.RENDER_DOWNLOAD_PROXY;
    else process.env.RENDER_DOWNLOAD_PROXY = previous;
  });

  it("does not use proxy for local minio urls", () => {
    const previous = process.env.RENDER_DOWNLOAD_PROXY;
    process.env.RENDER_DOWNLOAD_PROXY = "http://127.0.0.1:7897";
    expect(getDownloadProxy("http://localhost:9000/open-director/audio.mp3")).toBe("");
    if (previous === undefined) delete process.env.RENDER_DOWNLOAD_PROXY;
    else process.env.RENDER_DOWNLOAD_PROXY = previous;
  });

  it("does not use proxy for internal storage host urls", () => {
    const previousProxy = process.env.RENDER_DOWNLOAD_PROXY;
    const previousEndpoint = config.s3.endpoint;
    const previousPublicEndpoint = config.s3.publicEndpoint;
    process.env.RENDER_DOWNLOAD_PROXY = "http://127.0.0.1:7897";
    config.s3.endpoint = "http://minio:9000";
    config.s3.publicEndpoint = "http://localhost:9000";
    expect(getDownloadProxy("http://minio:9000/open-director/audio.mp3")).toBe("");
    if (previousProxy === undefined) delete process.env.RENDER_DOWNLOAD_PROXY;
    else process.env.RENDER_DOWNLOAD_PROXY = previousProxy;
    config.s3.endpoint = previousEndpoint;
    config.s3.publicEndpoint = previousPublicEndpoint;
  });

  it("rewrites localhost minio urls to the worker s3 endpoint", () => {
    const previous = config.s3.endpoint;
    config.s3.endpoint = "http://minio:9000";
    expect(resolveDownloadUrl("http://localhost:9000/open-director/audio.mp3")).toBe(
      "http://minio:9000/open-director/audio.mp3",
    );
    config.s3.endpoint = previous;
  });

  it("does not rewrite remote media urls", () => {
    const url = "https://videos.pexels.com/video-files/1/sample.mp4";
    expect(resolveDownloadUrl(url)).toBe(url);
  });

  it("treats transient network failures as retriable download errors", () => {
    expect(isRetriableDownloadError(new Error("Client network socket disconnected before secure TLS connection was established"))).toBe(
      true,
    );
    expect(isRetriableDownloadError(new Error("socket hang up"))).toBe(true);
    expect(isRetriableDownloadError(new Error("Download failed: 404 Not Found"))).toBe(false);
  });
});
