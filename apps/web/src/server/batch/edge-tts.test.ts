import { describe, expect, it } from "vitest";
import { buildEdgeTtsOptions, edgeSubtitleDurationSeconds, normalizeEdgeRate, subtitleTextFromScript } from "./edge-tts";

describe("edge tts helpers", () => {
  it("normalizes rate to signed percent", () => {
    expect(normalizeEdgeRate(1)).toBe("+0%");
    expect(normalizeEdgeRate(1.2)).toBe("+20%");
    expect(normalizeEdgeRate(0.75)).toBe("-25%");
  });

  it("normalizes subtitle text", () => {
    expect(subtitleTextFromScript("第一句。\n\n第二句。")).toBe("第一句。\n第二句。");
  });

  it("builds library options for edge tts", () => {
    expect(
      buildEdgeTtsOptions({
        script: "hello",
        voice: "zh-CN-XiaoxiaoNeural",
        rate: 1.2,
      }),
    ).toEqual({
      voice: "zh-CN-XiaoxiaoNeural",
      rate: "+20%",
      saveSubtitles: true,
      timeout: 30000,
    });
  });

  it("enables Edge TTS subtitle timing output", () => {
    expect(
      buildEdgeTtsOptions({
        script: "hello",
        voice: "zh-CN-XiaoxiaoNeural",
        rate: 1,
      }),
    ).toMatchObject({ saveSubtitles: true });
  });

  it("reads total audio duration from Edge TTS subtitle timings", () => {
    expect(
      edgeSubtitleDurationSeconds([
        { part: "hello", start: 100, end: 1100 },
        { part: "world", start: 1200, end: 2350 },
      ]),
    ).toBe(2.35);
  });

  it("includes proxy when configured", () => {
    expect(
      buildEdgeTtsOptions({
        script: "hello",
        voice: "zh-CN-XiaoxiaoNeural",
        rate: 1,
        proxy: "http://localhost:7890",
      }),
    ).toEqual({
      voice: "zh-CN-XiaoxiaoNeural",
      rate: "+0%",
      saveSubtitles: true,
      timeout: 30000,
      proxy: "http://localhost:7890",
    });
  });
});
