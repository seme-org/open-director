import { describe, expect, it } from "vitest";
import { ANIMATION_EFFECTS, SUBTITLE_STYLES, TRANSITION_STYLES } from "@/const/styleValue";
import { BATCH_EDGE_TTS_VOICES, BATCH_SUBTITLE_ANIMATION_OPTIONS, BATCH_SUBTITLE_STYLE_OPTIONS, BATCH_TRANSITION_OPTIONS } from "./batch-workbench-options";

describe("batch workbench options", () => {
  it("reuses creation export transition styles", () => {
    expect(BATCH_TRANSITION_OPTIONS.slice(1).map((option) => option.style)).toEqual(
      TRANSITION_STYLES.map((style) => style.value),
    );
  });

  it("reuses creation export subtitle styles and animation names", () => {
    expect(BATCH_SUBTITLE_STYLE_OPTIONS.slice(1).map((option) => option.style)).toEqual(
      SUBTITLE_STYLES.map((style) => style.value),
    );
    expect(BATCH_SUBTITLE_ANIMATION_OPTIONS.slice(1).map((option) => option.name)).toEqual(
      ANIMATION_EFFECTS.subtitle.map((animation) => animation.name),
    );
  });

  it("offers Edge TTS neural voices as selectable values", () => {
    expect(BATCH_EDGE_TTS_VOICES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "zh-CN-XiaoxiaoNeural" }),
        expect.objectContaining({ value: "en-US-JennyNeural" }),
      ]),
    );
  });
});
