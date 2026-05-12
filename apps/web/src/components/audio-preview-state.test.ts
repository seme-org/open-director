import { describe, expect, it } from "vitest";
import { getAudioPreviewPresentation } from "./audio-preview-state";

describe("getAudioPreviewPresentation", () => {
  it("keeps the preview label before playback starts", () => {
    expect(getAudioPreviewPresentation("配音试听", "idle")).toEqual({
      text: "配音试听",
      ariaLabel: "播放配音试听",
    });
  });

  it("shows a loading label while playback is buffering", () => {
    expect(getAudioPreviewPresentation("音乐试听", "loading")).toEqual({
      text: "加载中",
      ariaLabel: "音乐试听加载中",
    });
  });

  it("switches to pause while audio is playing", () => {
    expect(getAudioPreviewPresentation("旁白试听", "playing")).toEqual({
      text: "暂停",
      ariaLabel: "暂停旁白试听",
    });
  });
});
