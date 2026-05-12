import { describe, expect, it } from "vitest";
import { chooseMaterialProvider, parsePexelsVideos, parsePixabayVideos } from "./materials";

describe("chooseMaterialProvider", () => {
  it("uses one selected material provider", () => {
    expect(chooseMaterialProvider("local")).toEqual(["local"]);
    expect(chooseMaterialProvider("pexels")).toEqual(["pexels"]);
    expect(chooseMaterialProvider("pixabay")).toEqual(["pixabay"]);
  });
});

describe("provider parsers", () => {
  it("extracts matching pexels videos", () => {
    const body = {
      videos: [
        {
          duration: 8,
          video_files: [{ width: 1080, height: 1920, link: "https://video.test/a.mp4" }],
        },
      ],
    };
    expect(parsePexelsVideos(body, "9:16", 3)).toEqual([
      { provider: "pexels", url: "https://video.test/a.mp4", duration: 8 },
    ]);
  });

  it("extracts pixabay videos", () => {
    const body = {
      hits: [
        {
          duration: 9,
          videos: { large: { width: 1920, url: "https://video.test/b.mp4" } },
        },
      ],
    };
    expect(parsePixabayVideos(body, "16:9", 3)).toEqual([
      { provider: "pixabay", url: "https://video.test/b.mp4", duration: 9 },
    ]);
  });
});
