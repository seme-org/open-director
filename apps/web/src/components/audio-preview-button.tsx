"use client";

import { useMemo, useRef, useState, type MouseEvent } from "react";
import { LoaderCircle, Pause, Play } from "lucide-react";
import { getAudioPreviewPresentation, type AudioPreviewStatus } from "@/components/audio-preview-state";

let activeAudioPreview: HTMLAudioElement | null = null;

export function AudioPreviewButton({
  src,
  label = "试听",
  className = "",
}: {
  src?: string | null;
  label?: string;
  className?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [previewState, setPreviewState] = useState<{ src?: string | null; status: AudioPreviewStatus }>({ src, status: "idle" });
  const status = previewState.src === src ? previewState.status : "idle";
  const presentation = useMemo(() => getAudioPreviewPresentation(label, status), [label, status]);

  if (!src) return null;

  function setStatus(nextStatus: AudioPreviewStatus) {
    setPreviewState({ src, status: nextStatus });
  }

  function stopPlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    setStatus("idle");
  }

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;

    if (status === "playing" || status === "loading") {
      stopPlayback();
      return;
    }

    if (activeAudioPreview && activeAudioPreview !== audio) activeAudioPreview.pause();
    setStatus("loading");
    void audio.play().catch(() => {
      setStatus("idle");
    });
  }

  const Icon = status === "loading" ? LoaderCircle : status === "playing" ? Pause : Play;

  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.12] px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-white/20 ${status === "loading" ? "cursor-wait" : ""} ${className}`}
      onClick={handleClick}
      aria-label={presentation.ariaLabel}
      aria-busy={status === "loading"}
      title={presentation.ariaLabel}
    >
      <Icon className={`h-3.5 w-3.5 ${status === "loading" ? "animate-spin" : ""}`} />
      <span>{presentation.text}</span>
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onLoadStart={() => {
          if (status !== "idle") setStatus("loading");
        }}
        onWaiting={() => setStatus("loading")}
        onPlaying={() => {
          activeAudioPreview = audioRef.current;
          setStatus("playing");
        }}
        onPause={() => {
          if (activeAudioPreview === audioRef.current) activeAudioPreview = null;
          setStatus("idle");
        }}
        onEnded={() => {
          if (activeAudioPreview === audioRef.current) activeAudioPreview = null;
          setStatus("idle");
          if (audioRef.current) audioRef.current.currentTime = 0;
        }}
        onError={() => setStatus("idle")}
      />
    </button>
  );
}
