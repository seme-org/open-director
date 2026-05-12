import { describe, expect, it } from "vitest";
import { buildRenderInputsForBatchItem } from "./pipeline";
import { defaultBatchSettings } from "./settings";

describe("buildRenderInputsForBatchItem", () => {
  it("creates one render input per requested output", () => {
    const inputs = buildRenderInputsForBatchItem({
      batchItemId: "item_1",
      title: "测试标题",
      script: "这是脚本",
      audioUrl: "https://cdn.test/audio.mp3",
      videoUrls: ["https://cdn.test/a.mp4"],
      bgmUrl: "https://cdn.test/bgm.mp3",
      settings: { ...defaultBatchSettings, video: { ...defaultBatchSettings.video, outputsPerItem: 2 } },
    });

    expect(inputs).toHaveLength(2);
    expect(inputs[0].batchItemId).toBe("item_1");
    expect(inputs[0].narration_audio?.url).toBe("https://cdn.test/audio.mp3");
    expect(inputs[0].narration_audio?.text).toBe("这是脚本");
    expect(inputs[0].items[0].audio).toBeUndefined();
    expect(inputs[0].items[0].video?.duration).toBe(defaultBatchSettings.video.clipDuration);
    expect(inputs[0].bg_audios?.[0].url).toBe("https://cdn.test/bgm.mp3");
  });

  it("passes Edge TTS subtitle timings with the single full-script narration audio", () => {
    const inputs = buildRenderInputsForBatchItem({
      batchItemId: "item_1",
      title: "测试标题",
      script: "你知道吗？第二句。",
      audioUrl: "https://cdn.test/audio.mp3",
      audioDuration: 2.4,
      subtitleTimings: [
        { text: "你", start: 100, end: 250 },
        { text: "知道", start: 250, end: 675 },
        { text: "吗？", start: 675, end: 950 },
        { text: "第二句。", start: 950, end: 2400 },
      ],
      videoUrls: ["https://cdn.test/a.mp4", "https://cdn.test/b.mp4"],
      settings: { ...defaultBatchSettings, video: { ...defaultBatchSettings.video, clipDuration: 3, concatMode: "sequential" } },
    });

    expect(inputs[0].narration_audio).toEqual({
      url: "https://cdn.test/audio.mp3",
      text: "你知道吗？第二句。",
      duration: 2.4,
      subtitleTimings: [
        { text: "你", start: 100, end: 250 },
        { text: "知道", start: 250, end: 675 },
        { text: "吗？", start: 675, end: 950 },
        { text: "第二句。", start: 950, end: 2400 },
      ],
    });
    expect(inputs[0].items.map((item) => item.audio)).toEqual([undefined, undefined]);
  });

  it("reuses visual clips until the render timeline covers the full narration duration", () => {
    const inputs = buildRenderInputsForBatchItem({
      batchItemId: "item_1",
      title: "测试标题",
      script: "第一句。第二句。第三句。",
      audioUrl: "https://cdn.test/audio.mp3",
      audioDuration: 10.2,
      videoUrls: ["https://cdn.test/a.mp4", "https://cdn.test/b.mp4"],
      settings: { ...defaultBatchSettings, video: { ...defaultBatchSettings.video, clipDuration: 3, concatMode: "sequential" } },
    });

    expect(inputs[0].items).toHaveLength(4);
    expect(inputs[0].items.map((item) => item.video?.url)).toEqual([
      "https://cdn.test/a.mp4",
      "https://cdn.test/b.mp4",
      "https://cdn.test/a.mp4",
      "https://cdn.test/b.mp4",
    ]);
    expect(inputs[0].items.reduce((sum, item) => sum + (item.video?.duration ?? 0), 0)).toBe(12);
  });

  it("splits script subtitles across video clips", () => {
    const inputs = buildRenderInputsForBatchItem({
      batchItemId: "item_1",
      title: "测试标题",
      script: "第一句。第二句。第三句。",
      audioUrl: "https://cdn.test/audio.mp3",
      videoUrls: ["https://cdn.test/a.mp4", "https://cdn.test/b.mp4", "https://cdn.test/c.mp4"],
      settings: defaultBatchSettings,
    });

    expect(inputs[0].items.map((item) => item.sub_title?.text)).toEqual(["第一句。", "第二句。", "第三句。"]);
  });

  it("disables subtitle animation", () => {
    const inputs = buildRenderInputsForBatchItem({
      batchItemId: "item_1",
      title: "测试标题",
      script: "这是脚本",
      audioUrl: "https://cdn.test/audio.mp3",
      videoUrls: ["https://cdn.test/a.mp4"],
      settings: defaultBatchSettings,
    });

    expect(inputs[0].input_parameter?.advancedParameters?.isGenerateSubtitleAnimation).toBe("no");
  });

  it("uses clipDuration for video and audio", () => {
    const inputs = buildRenderInputsForBatchItem({
      batchItemId: "item_1",
      title: "测试标题",
      script: "脚本",
      audioUrl: "https://cdn.test/audio.mp3",
      videoUrls: ["https://cdn.test/a.mp4"],
      settings: { ...defaultBatchSettings, video: { ...defaultBatchSettings.video, clipDuration: 4 } },
    });

    expect(inputs[0].items[0].video?.duration).toBe(4);
    expect(inputs[0].narration_audio?.duration).toBeUndefined();
  });
});
