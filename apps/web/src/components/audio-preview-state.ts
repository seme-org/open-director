export type AudioPreviewStatus = "idle" | "loading" | "playing";

export function getAudioPreviewPresentation(label: string, status: AudioPreviewStatus) {
  if (status === "loading") {
    return {
      text: "加载中",
      ariaLabel: `${label}加载中`,
    };
  }

  if (status === "playing") {
    return {
      text: "暂停",
      ariaLabel: `暂停${label}`,
    };
  }

  return {
    text: label,
    ariaLabel: `播放${label}`,
  };
}
