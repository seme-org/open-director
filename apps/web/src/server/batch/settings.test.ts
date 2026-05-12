import { describe, expect, it } from "vitest";
import { defaultBatchSettings, normalizeBatchSettings } from "./settings";

describe("batch settings", () => {
  it("defaults to the built-in batch controls", () => {
    expect(defaultBatchSettings.tts.provider).toBe("edge");
    expect(defaultBatchSettings.materials.source).toBe("local");
    expect(defaultBatchSettings.bgm.source).toBe("random");
    expect(defaultBatchSettings.video.transition.enabled).toBe(false);
    expect(defaultBatchSettings.mediaGeneration.aiImages).toBe(false);
    expect(defaultBatchSettings.mediaGeneration.aiVideos).toBe(false);
  });

  it("clamps simultaneous output count to 1-5", () => {
    expect(normalizeBatchSettings({ video: { outputsPerItem: 99 } }).video.outputsPerItem).toBe(5);
  });

  it("keeps saved user settings across normalization", () => {
    const settings = normalizeBatchSettings({
      video: {
        aspectRatio: "16:9",
        resolution: 1080,
        outputsPerItem: 3,
        clipDuration: 8,
        concatMode: "sequential",
        transition: { enabled: true, style: "fade" },
      },
      materials: { source: "local", localDirectory: "assets/custom", searchMode: "script" },
      tts: { provider: "edge", server: "azure-tts-v2", voice: "zh-CN-YunxiNeural", rate: 1.2, volume: 0.8 },
      bgm: { source: "first", directory: "assets/bgm/default", file: "", volume: 0.5 },
      subtitle: {
        enabled: true,
        position: "custom",
        customPosition: 72,
        fontName: "font.ttf",
        fontSize: 60,
        color: "#fff",
        backgroundColor: false,
        strokeColor: "#000",
        strokeWidth: 1.5,
        style: "bold-caption",
      },
    });

    expect(settings.video.transition).toEqual({ enabled: true, style: "fade" });
    expect(settings.tts.server).toBe("azure-tts-v2");
    expect(settings.bgm.source).toBe("random");
    expect(settings.subtitle.customPosition).toBe(72);
    expect(settings.subtitle.style).toBe("bold-caption");
  });

  it("keeps only useful script settings", () => {
    const settings = normalizeBatchSettings({
      script: {
        language: "zh-CN",
        tone: "dramatic",
        paragraphCount: 6,
      },
    });

    expect(settings.script).toEqual({
      language: "zh-CN",
      audience: defaultBatchSettings.script.audience,
    });
    expect("tone" in settings.script).toBe(false);
    expect("paragraphCount" in settings.script).toBe(false);
  });

  it("supports pexels, pixabay, and uploaded local file video sources", () => {
    expect(normalizeBatchSettings({ materials: { source: "pexels" } }).materials.source).toBe("pexels");
    expect(normalizeBatchSettings({ materials: { source: "pixabay" } }).materials.source).toBe("pixabay");
    expect(normalizeBatchSettings({ materials: { source: "local", uploadedUrls: ["https://cdn.test/a.mp4"] } }).materials).toMatchObject({
      source: "local",
      uploadedUrls: ["https://cdn.test/a.mp4"],
    });
    expect(normalizeBatchSettings({ materials: { source: "local-pexels" } }).materials.source).toBe("local");
  });

  it("keeps subtitle animation settings", () => {
    const settings = normalizeBatchSettings({
      subtitle: {
        animationEnabled: true,
        animationName: "slideInUp",
      },
    });

    expect(settings.subtitle.animationEnabled).toBe(true);
    expect(settings.subtitle.animationName).toBe("slideInUp");
  });
});
