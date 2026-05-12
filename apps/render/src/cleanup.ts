import fs from "fs-extra";
import path from "node:path";
import { cacheDir, outputDir } from "./config.js";

export async function cleanupFiles(
  files: string[],
  dirs: string[] = [],
): Promise<void> {
  for (const f of files) {
    try {
      await fs.remove(f);
    } catch {}
  }
  for (const d of dirs) {
    try {
      await fs.remove(d);
    } catch {}
  }
}

export async function cleanExpiredCache(): Promise<void> {
  const maxAge = 24 * 60 * 60 * 1000;
  const now = Date.now();

  for (const dir of [cacheDir, outputDir]) {
    try {
      if (!(await fs.pathExists(dir))) continue;
      const entries = await fs.readdir(dir);
      for (const entry of entries) {
        if (entry.endsWith("_pixel.png")) continue;
        const fullPath = path.join(dir, entry);
        try {
          const stat = await fs.stat(fullPath);
          if (now - stat.mtimeMs > maxAge) {
            await fs.remove(fullPath);
          }
        } catch {}
      }
    } catch {}
  }
}
