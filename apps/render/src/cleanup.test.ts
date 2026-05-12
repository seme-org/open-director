import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("fs-extra", () => ({
  default: {
    remove: vi.fn().mockResolvedValue(undefined),
    pathExists: vi.fn().mockResolvedValue(true),
    readdir: vi.fn().mockResolvedValue([]),
    stat: vi.fn(),
    ensureDirSync: vi.fn(),
  },
}));

import fs from "fs-extra";
import { cleanupFiles, cleanExpiredCache } from "./cleanup.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("cleanupFiles", () => {
  it("removes each file individually", async () => {
    await cleanupFiles(["/tmp/a.mp3", "/tmp/b.mp3"]);
    expect(fs.remove).toHaveBeenCalledWith("/tmp/a.mp3");
    expect(fs.remove).toHaveBeenCalledWith("/tmp/b.mp3");
  });

  it("removes directories when provided", async () => {
    await cleanupFiles([], ["/tmp/workdir"]);
    expect(fs.remove).toHaveBeenCalledWith("/tmp/workdir");
  });

  it("does not throw when a file removal fails", async () => {
    (fs.remove as any).mockRejectedValueOnce(new Error("ENOENT"));
    await expect(cleanupFiles(["/tmp/missing.mp3"])).resolves.toBeUndefined();
  });

  it("handles empty inputs", async () => {
    await cleanupFiles([]);
    expect(fs.remove).not.toHaveBeenCalled();
  });
});

describe("cleanExpiredCache", () => {
  it("removes entries older than 24 hours", async () => {
    const now = Date.now();
    (fs.readdir as any).mockResolvedValue(["old-file.mp4"]);
    (fs.stat as any).mockResolvedValue({ mtimeMs: now - 25 * 60 * 60 * 1000 });

    await cleanExpiredCache();
    expect(fs.remove).toHaveBeenCalled();
  });

  it("skips entries newer than 24 hours", async () => {
    const now = Date.now();
    (fs.readdir as any).mockResolvedValue(["new-file.mp4"]);
    (fs.stat as any).mockResolvedValue({ mtimeMs: now - 1000 });

    await cleanExpiredCache();
    expect(fs.remove).not.toHaveBeenCalled();
  });

  it("skips _pixel.png files", async () => {
    const now = Date.now();
    (fs.readdir as any).mockResolvedValue(["abc_pixel.png"]);
    (fs.stat as any).mockResolvedValue({ mtimeMs: now - 25 * 60 * 60 * 1000 });

    await cleanExpiredCache();
    expect(fs.remove).not.toHaveBeenCalled();
  });

  it("skips directories that do not exist", async () => {
    (fs.pathExists as any).mockResolvedValue(false);
    await cleanExpiredCache();
    expect(fs.readdir).not.toHaveBeenCalled();
  });
});
