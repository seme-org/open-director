import { describe, expect, it } from "vitest";
import { resolveSceneDuration, resolveSubtitleSegmentsForScene } from "./render-timing.js";

describe("resolveSceneDuration", () => {
  it("uses requested clip duration before the full probed source duration", () => {
    expect(
      resolveSceneDuration({
        video: { url: "https://cdn.test/video.mp4", duration: 3 },
        videoPath: "/tmp/video.mp4",
        probedVideoDuration: 42,
      }),
    ).toBe(3);
  });

  it("falls back to probed video duration when no clip duration is requested", () => {
    expect(resolveSceneDuration({ videoPath: "/tmp/video.mp4", probedVideoDuration: 8 })).toBe(8);
  });

  it("keeps requested clip duration when global narration audio exists", () => {
    expect(
      resolveSceneDuration(
        { video: { url: "https://cdn.test/video.mp4", duration: 3 }, probedVideoDuration: 42 },
        24,
        6,
      ),
    ).toBe(3);
  });

  it("clips global Edge TTS subtitle timings into scene-local seconds", () => {
    expect(
      resolveSubtitleSegmentsForScene(
        [
          { text: "第一", start: 100, end: 600 },
          { text: "句", start: 600, end: 1200 },
          { text: "第二", start: 3100, end: 3900 },
          { text: "句。", start: 3900, end: 4600 },
          { text: "第三句", start: 6100, end: 7200 },
        ],
        3,
        3,
      ),
    ).toEqual([
      { text: "第二句。", start: 0.1, end: 1.6 },
    ]);
  });

  it("groups Edge TTS word timings into readable subtitle phrases", () => {
    expect(
      resolveSubtitleSegmentsForScene(
        [
          { text: "你", start: 100, end: 237 },
          { text: "知道", start: 250, end: 600 },
          { text: "吗，", start: 600, end: 850 },
          { text: "唐朝", start: 1175, end: 1625 },
          { text: "的", start: 1625, end: 1750 },
          { text: "人", start: 1750, end: 2050 },
          { text: "其实", start: 2150, end: 2487 },
          { text: "真的", start: 2500, end: 2800 },
          { text: "把", start: 2800, end: 2925 },
          { text: "胖", start: 2925, end: 3162 },
        ],
        0,
        4,
      ),
    ).toEqual([
      { text: "你知道吗，", start: 0.1, end: 0.85 },
      { text: "唐朝的人其实真的把胖", start: 1.175, end: 3.162 },
    ]);
  });

  it("does not duplicate a word timing that crosses a scene boundary", () => {
    const timings = [
      { text: "很多", start: 2537, end: 2937 },
      { text: "人", start: 2937, end: 3275 },
      { text: "以为", start: 3275, end: 3675 },
      { text: "在", start: 3700, end: 3850 },
      { text: "那个", start: 3850, end: 4100 },
      { text: "时代，", start: 4100, end: 4475 },
    ];

    expect(resolveSubtitleSegmentsForScene(timings, 0, 3)).toEqual([
      { text: "很多人", start: 2.537, end: 3 },
    ]);
    expect(resolveSubtitleSegmentsForScene(timings, 3, 3)).toEqual([
      { text: "以为在那个时代，", start: 0.275, end: 1.475 },
    ]);
  });
});
