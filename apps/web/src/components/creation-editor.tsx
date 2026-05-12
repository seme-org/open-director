"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent, type WheelEvent } from "react";
import Link from "next/link";
import { Check, CheckCircle, ChevronDown, ChevronLeft, Clapperboard, Download, ImageIcon, LoaderCircle, Mic2, Music2, Pause, Play, Subtitles, Upload, Volume2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { withLocale, type Locale } from "@/i18n.config";
import { AudioPreviewButton } from "@/components/audio-preview-button";
import { CreationExportDialog, createInitialExportPreset } from "@/components/creation-export-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  buildCreationExportPayload,
  buildCreationPreparationStatus,
  buildCreationAssetsPollIntervalMs,
  buildPreviewBgmTracks,
  buildResourcePreloadKey,
  buildStoryboardAssetGroups,
  applyAssetDurationMeasurement,
  getCreationAssetDuration,
  getEqualStoryboardTimelineBlockWidths,
  getStoryboardPreviewDurations,
  getStoryboardStartSeconds,
  getPreviewVoiceAsset,
  getVariablePlayheadPosition,
  getVariablePreviewFrameIndex,
  getVariableTimelineSeekSeconds,
  mergePolledCreationAssets,
  mapJobToExportState,
  resolveCreationAspectRatio,
  shouldShowPreviewTitle,
  type CreationAsset,
  type CreationBlock,
  type CreationExportState,
  type CreationToolCall,
} from "@/components/creation-export";

type CreationRecipe = {
  title?: string;
  aspectRatio?: string;
  aspect_ratio?: string;
  artStyle?: { name?: string; description?: string };
};

type ExportHistoryItem = {
  id: string;
  status: string;
  progress: number;
  createdAt: string;
  videoUrl?: string;
};

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes.toString().padStart(2, "0")}:${rest.toString().padStart(2, "0")}`;
}

export function CreationEditor({
  locale,
  threadId,
  recipe,
  blocks,
  assets,
  aspectRatio,
}: {
  locale: Locale;
  threadId: string;
  recipe: CreationRecipe;
  blocks: CreationBlock[];
  assets: CreationAsset[];
  aspectRatio?: string;
}) {
  const t = useTranslations();
  const [exportOpen, setExportOpen] = useState(false);
  const [exportHistoryOpen, setExportHistoryOpen] = useState(false);
  const [exportHistory, setExportHistory] = useState<ExportHistoryItem[]>([]);
  const [exportHistoryLoading, setExportHistoryLoading] = useState(false);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [resolution, setResolution] = useState<480 | 720 | 1080>(720);
  const [exportPreset, setExportPreset] = useState(createInitialExportPreset);
  const [exportState, setExportState] = useState<CreationExportState>({
    status: "idle",
    progress: 0,
    message: "Choose export settings and start rendering.",
  });
  const [activeTab, setActiveTab] = useState<"storyboard" | "voiceover" | "music">("storyboard");
  const [selectedBlockIndex, setSelectedBlockIndex] = useState(0);
  const [selectedAssetIndex, setSelectedAssetIndex] = useState(0);
  const [liveAssets, setLiveAssets] = useState(assets);
  const [toolCalls, setToolCalls] = useState<CreationToolCall[]>([]);
  const [preparationStarted, setPreparationStarted] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewElapsed, setPreviewElapsed] = useState(0);
  const [previewSeekVersion, setPreviewSeekVersion] = useState(0);
  const [editedVisualPrompt, setEditedVisualPrompt] = useState("");
  const [imageRevisionPrompt, setImageRevisionPrompt] = useState("");
  const [resourceLoadProgress, setResourceLoadProgress] = useState(assets.length ? 0 : 100);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const bgmAudioRefs = useRef(new Map<string, HTMLAudioElement>());
  const previewElapsedRef = useRef(0);
  const lastVoiceUrlRef = useRef<string | null>(null);
  const lastVoiceSeekVersionRef = useRef(-1);
  const lastVoicePlayingRef = useRef(false);
  const lastBgmSyncRef = useRef<{ playing: boolean; elapsed: number; urls: string }>({ playing: false, elapsed: -1, urls: "" });
  const storyboardGroups = useMemo(() => buildStoryboardAssetGroups(blocks, liveAssets), [liveAssets, blocks]);
  const preparationStatus = useMemo(() => buildCreationPreparationStatus({ blocks, assets: liveAssets, toolCalls }), [blocks, liveAssets, toolCalls]);
  const resourcePreloadKey = useMemo(() => buildResourcePreloadKey(liveAssets), [liveAssets]);
  const selectedGroup = storyboardGroups[selectedBlockIndex] || storyboardGroups[0];
  const selectableFrames = selectedGroup?.visualAssets ?? [];
  const primaryFrame = selectableFrames[selectedAssetIndex] || selectedGroup?.displayAsset || liveAssets.find((asset) => asset.type === "IMAGE" && asset.url);
  const voiceAssets = selectedGroup?.voiceAssets ?? [];
  const musicAssets = storyboardGroups.musicAssets;
  const selectedBlock = blocks[selectedBlockIndex] || blocks[0];
  const fallbackPreviewSeconds = 5;
  const previewDurations = useMemo(() => getStoryboardPreviewDurations(storyboardGroups, fallbackPreviewSeconds), [storyboardGroups]);
  const previewDuration = Math.max(fallbackPreviewSeconds, previewDurations.reduce((total, duration) => total + duration, 0));
  const previewBlockIndex = getVariablePreviewFrameIndex({
    elapsedSeconds: previewElapsed,
    durations: previewDurations,
  });
  const previewGroup = storyboardGroups[previewBlockIndex] || storyboardGroups[0];
  const previewFrame = previewGroup?.displayAsset || primaryFrame;
  const previewBlock = blocks[previewBlockIndex] || selectedBlock;
  const previewVoiceAsset = getPreviewVoiceAsset(storyboardGroups, previewBlockIndex);
  const bgmTracks = useMemo(() => buildPreviewBgmTracks(musicAssets, previewDuration), [musicAssets, previewDuration]);
  const timelineBlockWidth = 160;
  const timelineBlockGap = 8;
  const timelineBlockWidths = useMemo(() => getEqualStoryboardTimelineBlockWidths(blocks.length, timelineBlockWidth), [blocks.length]);
  const previewDurationsKey = previewDurations.join("|");
  const timelineContentWidth = Math.max(0, timelineBlockWidths.reduce((total, width) => total + width, 0) + Math.max(0, blocks.length - 1) * timelineBlockGap);
  const playheadPosition = getVariablePlayheadPosition({
    elapsedSeconds: previewElapsed,
    durations: previewDurations,
    blockWidths: timelineBlockWidths,
    blockGap: timelineBlockGap,
  });
  const previewBlockStartSeconds = getStoryboardStartSeconds(previewDurations, previewBlockIndex);
  const showPreviewTitle = shouldShowPreviewTitle({ elapsedSeconds: previewElapsed });

  function pauseAudio(audio: HTMLAudioElement | null) {
    if (!audio) return;
    audio.pause();
  }

  function syncAudioTime(audio: HTMLAudioElement, nextTime: number) {
    if (!Number.isFinite(nextTime)) return;
    try {
      audio.currentTime = Math.max(0, nextTime);
    } catch {
      // Some remote audio elements reject currentTime before metadata is ready.
    }
  }

  function playAudio(audio: HTMLAudioElement | null) {
    if (!audio) return;
    void audio.play().catch(() => {
      setPreviewPlaying(false);
    });
  }

  function seekPreview(nextElapsed: number) {
    const clamped = Math.max(0, Math.min(previewDuration, nextElapsed));
    setPreviewElapsed(clamped);
    setSelectedBlockIndex(getVariablePreviewFrameIndex({
      elapsedSeconds: clamped,
      durations: previewDurations,
    }));
    setSelectedAssetIndex(0);
    setPreviewSeekVersion((version) => version + 1);
  }

  function handleTimelineClick(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    seekPreview(getVariableTimelineSeekSeconds({
      offsetX: event.clientX - rect.left,
      durations: previewDurations,
      blockWidths: timelineBlockWidths,
      blockGap: timelineBlockGap,
    }));
  }

  function handleTimelineWheel(event: WheelEvent<HTMLDivElement>) {
    const container = timelineScrollRef.current;
    if (!container || event.deltaY === 0) return;
    event.preventDefault();
    container.scrollLeft += event.deltaY;
  }

  async function startExport() {
    if (exportState.status === "exporting") return;
    try {
      setExportState({
        status: "exporting",
        progress: 0,
        message: "Starting export",
      });
      const response = await fetch("/api/render/quick-concat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildCreationExportPayload({
          threadId,
          title: recipe.title || "OpenDirector export",
          resolution,
          aspectRatio: aspectRatio || resolveCreationAspectRatio(recipe),
          preset: exportPreset,
          blocks,
          assets: liveAssets,
        })),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(String(data.error || "Export failed"));
      setExportState({
        status: "exporting",
        progress: 1,
        message: "Queued for rendering",
        jobId: String(data.jobId),
      });
    } catch (error) {
      setExportState({
        status: "error",
        progress: 0,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  useEffect(() => {
    if (!exportState.jobId || exportState.status !== "exporting") return;

    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch(`/api/jobs/${exportState.jobId}`);
        const data = await response.json();
        if (!response.ok) throw new Error(String(data.error || "Failed to fetch export status"));
        if (!cancelled) setExportState(mapJobToExportState(data.job));
      } catch (error) {
        if (!cancelled) {
          setExportState((previous) => ({
            ...previous,
            status: "error",
            message: error instanceof Error ? error.message : String(error),
          }));
        }
      }
    };

    const timer = window.setInterval(() => void poll(), 2000);
    void poll();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [exportState.jobId, exportState.status]);

  useEffect(() => {
    previewElapsedRef.current = previewElapsed;
  }, [previewElapsed]);

  useEffect(() => {
    if (!previewPlaying) return;
    const timer = window.setInterval(() => {
      setPreviewElapsed((previous) => {
        const next = previous + 0.25;
        if (next >= previewDuration) {
          setPreviewPlaying(false);
          return 0;
        }
        return next;
      });
    }, 250);
    return () => window.clearInterval(timer);
  }, [previewDuration, previewPlaying]);

  useEffect(() => {
    const index = getVariablePreviewFrameIndex({
      elapsedSeconds: previewElapsed,
      durations: previewDurations,
    });
    setSelectedBlockIndex(index);
    if (previewPlaying) setSelectedAssetIndex(0);
  }, [previewDurations, previewDurationsKey, previewElapsed, previewPlaying]);

  useEffect(() => {
    const voiceAudio = voiceAudioRef.current;
    const voiceUrl = previewVoiceAsset?.url || null;
    const localVoiceElapsed = previewElapsedRef.current - previewBlockStartSeconds;
    if (!previewPlaying) {
      pauseAudio(voiceAudio);
      lastVoiceUrlRef.current = voiceUrl;
      lastVoicePlayingRef.current = false;
      return;
    }
    if (!voiceAudio || !voiceUrl) return;
    if (lastVoiceUrlRef.current !== voiceUrl || lastVoiceSeekVersionRef.current !== previewSeekVersion || !lastVoicePlayingRef.current) {
      syncAudioTime(voiceAudio, localVoiceElapsed);
    }
    lastVoiceUrlRef.current = voiceUrl;
    lastVoiceSeekVersionRef.current = previewSeekVersion;
    lastVoicePlayingRef.current = true;
    if (voiceAudio.paused) playAudio(voiceAudio);
  }, [previewBlockIndex, previewBlockStartSeconds, previewPlaying, previewSeekVersion, previewVoiceAsset?.url]);

  useEffect(() => {
    const activeUrls = new Set(bgmTracks.map((track) => track.url));
    bgmAudioRefs.current.forEach((audio, url) => {
      if (!activeUrls.has(url)) {
        pauseAudio(audio);
        bgmAudioRefs.current.delete(url);
      }
    });

    const urlsKey = bgmTracks.map((track) => track.url).join("|");
    const shouldResync = lastBgmSyncRef.current.playing !== previewPlaying || Math.abs(lastBgmSyncRef.current.elapsed - previewElapsed) > 0.75 || lastBgmSyncRef.current.urls !== urlsKey;
    if (!previewPlaying) {
      bgmAudioRefs.current.forEach((audio) => pauseAudio(audio));
      lastBgmSyncRef.current = { playing: false, elapsed: previewElapsed, urls: urlsKey };
      return;
    }

    bgmTracks.forEach((track) => {
      const audio = bgmAudioRefs.current.get(track.url);
      if (!audio) return;
      audio.volume = Math.max(0, Math.min(1, track.volume));
      if (shouldResync) syncAudioTime(audio, Math.max(0, previewElapsed - track.startSeconds));
      playAudio(audio);
    });
    lastBgmSyncRef.current = { playing: true, elapsed: previewElapsed, urls: urlsKey };
  }, [bgmTracks, previewElapsed, previewPlaying]);

  useEffect(() => {
    const meta = primaryFrame?.metadata as Record<string, unknown> | undefined;
    const task = meta?.task as Record<string, unknown> | undefined;
    const assetPrompt = (task?.prompt || meta?.prompt) as string | undefined;
    const fallbackPrompt = textValue(selectedBlock?.visualPrompt, textValue(recipe.artStyle?.description, ""));
    setEditedVisualPrompt(assetPrompt || fallbackPrompt);
    setImageRevisionPrompt("");
    setSelectedAssetIndex(0);
  }, [recipe.artStyle?.description, selectedBlock?.id, selectedBlock?.visualPrompt, primaryFrame?.id]);

  useEffect(() => {
    let cancelled = false;
    const urls = JSON.parse(resourcePreloadKey) as string[];
    if (!urls.length) {
      setResourceLoadProgress(100);
      return;
    }
    let loaded = 0;
    const update = () => {
      loaded += 1;
      if (!cancelled) setResourceLoadProgress(Math.round((loaded / urls.length) * 100));
    };
    urls.forEach((url) => {
      if (/\.(png|jpe?g|webp|gif)(\?|$)/i.test(url)) {
        const image = new Image();
        image.onload = update;
        image.onerror = update;
        image.src = url;
      } else {
        fetch(url, { method: "GET", mode: "no-cors" }).then(update).catch(update);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [resourcePreloadKey]);

  useEffect(() => {
    const audioAssetsNeedingDuration = liveAssets.filter((asset) => asset.type === "AUDIO" && asset.url && !getCreationAssetDuration(asset));
    if (!audioAssetsNeedingDuration.length) return;
    let cancelled = false;
    const audioElements: HTMLAudioElement[] = [];
    audioAssetsNeedingDuration.forEach((asset) => {
      if (!asset.url) return;
      const audio = new Audio();
      audio.preload = "metadata";
      const cleanup = () => {
        audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
        audio.removeEventListener("durationchange", handleLoadedMetadata);
        audio.removeEventListener("error", cleanup);
      };
      const handleLoadedMetadata = () => {
        if (!cancelled && Number.isFinite(audio.duration) && audio.duration > 0) {
          setLiveAssets((previous) => applyAssetDurationMeasurement(previous, asset.id, audio.duration));
        }
        cleanup();
      };
      audio.addEventListener("loadedmetadata", handleLoadedMetadata);
      audio.addEventListener("durationchange", handleLoadedMetadata);
      audio.addEventListener("error", cleanup);
      audio.src = asset.url;
      audio.load();
      audioElements.push(audio);
    });
    return () => {
      cancelled = true;
      audioElements.forEach((audio) => {
        audio.removeAttribute("src");
        audio.load();
      });
    };
  }, [liveAssets]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch(`/api/thread/${threadId}/assets`);
        const data = await response.json();
        if (!response.ok) throw new Error(String(data.error || "Failed to fetch creation assets"));
        if (cancelled) return;
        if (Array.isArray(data.assets)) setLiveAssets((previous) => mergePolledCreationAssets(previous, data.assets));
        if (Array.isArray(data.toolCalls)) setToolCalls(data.toolCalls);
      } catch {
        // Keep the editor usable with the last known asset state.
      }
    };
    void poll();
    const pollIntervalMs = buildCreationAssetsPollIntervalMs({ isComplete: preparationStatus.isComplete });
    if (!pollIntervalMs) {
      return () => {
        cancelled = true;
      };
    }
    const timer = window.setInterval(() => void poll(), pollIntervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [preparationStatus.isComplete, threadId]);

  useEffect(() => {
    if (!exportHistoryOpen) return;
    let cancelled = false;
    setExportHistoryLoading(true);
    fetch(`/api/thread/${threadId}/exports`)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setExportHistory(Array.isArray(data.exports) ? data.exports : []);
      })
      .catch(() => {
        if (!cancelled) setExportHistory([]);
      })
      .finally(() => {
        if (!cancelled) setExportHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [exportHistoryOpen, threadId]);

  const showHeaderProgress = !exportOpen && exportState.status !== "idle";
  const exporting = exportState.status === "exporting";

  return (
    <main className="h-screen overflow-hidden bg-black text-white">
      {previewVoiceAsset?.url ? <audio ref={voiceAudioRef} src={previewVoiceAsset.url} preload="auto" className="hidden" /> : null}
      {bgmTracks.map((track) => (
        <audio
          key={track.id}
          ref={(element) => {
            if (element) {
              bgmAudioRefs.current.set(track.url, element);
            } else {
              bgmAudioRefs.current.delete(track.url);
            }
          }}
          src={track.url}
          preload="auto"
          loop
          className="hidden"
        />
      ))}
      <header className="flex h-14 items-center justify-between border-b border-white/10 bg-slate-950/70 px-4 backdrop-blur-xl">
        <Link href={withLocale(locale, `/chat/${threadId}`)} className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white">
          <ChevronLeft className="h-4 w-4" />
          返回
        </Link>
        <div className="flex items-center gap-2">
          {!preparationStatus.isComplete ? (
            <div className="hidden h-8 items-center gap-2 rounded-md border border-amber-300/25 bg-amber-300/10 px-3 text-xs text-amber-100 md:inline-flex">
              {preparationStatus.hasRunningTasks || preparationStarted ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
              <span>素材生成中</span>
              <span className="text-amber-50">{preparationStatus.readyVisuals}/{Math.max(1, preparationStatus.totalBlocks)} 图</span>
              <span className="text-amber-50">{preparationStatus.readyVoices}/{Math.max(1, preparationStatus.totalBlocks)} 音</span>
            </div>
          ) : null}
          {showHeaderProgress ? (
            <button onClick={() => setExportOpen(true)} className="hidden h-8 min-w-48 items-center gap-2 rounded-md border border-cyan-400/30 bg-cyan-500/10 px-3 text-sm text-cyan-100 transition hover:bg-cyan-500/20 md:inline-flex">
              {exporting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              <span className="max-w-28 truncate">{exportState.message}</span>
              <span className="ml-auto text-xs text-cyan-200">{exportState.progress}%</span>
            </button>
          ) : null}
          <button onClick={() => setExportHistoryOpen(true)} className="hidden h-8 items-center gap-2 rounded-md border border-cyan-400/30 bg-cyan-500/10 px-3 text-sm text-cyan-100 transition hover:bg-cyan-500/20 md:inline-flex">
            <Clapperboard className="h-4 w-4" />
            导出历史
          </button>
          <button onClick={() => setExportOpen(true)} className="inline-flex h-8 items-center gap-2 rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 px-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:from-blue-500 hover:to-indigo-500">
            <Download className="h-4 w-4" />
            导出视频
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </header>

      {resourceLoadProgress < 100 && assets.length > 0 && liveAssets.length === assets.length ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 backdrop-blur-sm">
          <div className="w-[min(420px,calc(100vw-32px))] rounded-lg border border-white/10 bg-zinc-950 p-5 shadow-2xl">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-white">加载资源</span>
              <span className="font-mono text-cyan-100">{resourceLoadProgress}%</span>
            </div>
            <Progress value={resourceLoadProgress} className="mt-4 h-2 bg-white/[0.08]" indCls="bg-cyan-300" />
            <p className="mt-3 text-xs text-slate-500">正在下载图片、配音和背景音乐素材...</p>
          </div>
        </div>
      ) : null}

      <div className="flex h-[calc(100vh-3.5rem)] min-h-0">
        <aside className="hidden h-full w-[25%] min-w-[360px] max-w-[520px] border-r border-white/10 bg-black md:flex">
          <nav className="flex w-14 shrink-0 flex-col items-center border-r border-white/10 bg-[#070707] py-4">
            <div className="flex flex-1 flex-col items-center gap-5">
                {[
                  { id: "storyboard" as const, label: "分镜", icon: ImageIcon },
                  { id: "voiceover" as const, label: "配音", icon: Volume2 },
                  { id: "music" as const, label: "音乐", icon: Music2 },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex w-full flex-col items-center gap-1 border-l-2 py-1 text-[11px] transition ${active ? "border-violet-400 text-white" : "border-transparent text-zinc-500 hover:text-zinc-200"}`}
                    >
                      <span className={`grid size-9 place-items-center rounded-full ${active ? "bg-white/15" : "bg-transparent"}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      {tab.label}
                    </button>
                  );
                })}
            </div>
          </nav>
          <div className="grid min-w-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-3 p-3">
            <div className="rounded-2xl border border-white/10 bg-[#151515] px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <span className="size-2 rounded-sm bg-zinc-500" />
                分镜{selectedBlockIndex + 1}
              </div>
            </div>

            <div className="min-h-0 overflow-y-auto rounded-2xl border border-white/10 bg-[#151515] p-3">
              {activeTab === "storyboard" ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-white/10 bg-[#242424] p-4">
                    <div className="mb-3 flex items-center justify-between text-sm font-semibold text-white">
                      <span className="inline-flex items-center gap-2"><ImageIcon className="h-4 w-4" /> 分镜图</span>
                      <ChevronDown className="h-4 w-4 text-zinc-400" />
                    </div>

                    <div className="overflow-hidden rounded-lg border border-white/10 bg-black/25">
                      <div className="grid place-items-center bg-[#202020] p-3">
                        {primaryFrame?.url ? (
                          <img src={primaryFrame.url} alt="" className="max-h-48 rounded-md object-contain" />
                        ) : (
                          <div className="grid h-48 w-full place-items-center rounded-md border border-dashed border-white/15 bg-black/30 text-center">
                            <div>
                              <LoaderCircle className="mx-auto h-5 w-5 animate-spin text-cyan-200" />
                              <p className="mt-2 text-sm font-medium text-white">分镜图生成中</p>
                              <p className="mt-1 text-xs text-slate-500">WaveSpeed 完成后会自动显示</p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3 border-t border-white/10 p-3">
                        <label className="block text-xs font-medium text-slate-400">图片提示词</label>
                        <div className="min-h-28 whitespace-pre-wrap rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm leading-6 text-slate-200">
                          {editedVisualPrompt || "暂无图片提示词"}
                        </div>

                        {/* TODO: 分镜修改功能 - 第二版再开放
                        <label className="block text-xs font-medium text-slate-400">修改当前分镜图</label>
                        <textarea
                          value={imageRevisionPrompt}
                          onChange={(event) => setImageRevisionPrompt(event.target.value)}
                          placeholder="描述要怎么改当前这张分镜图，例如：小马往前走一点，背景增加河流反光。"
                          className="min-h-24 w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm leading-6 text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50"
                        />

                        <button
                          type="button"
                          disabled={!imageRevisionPrompt.trim() || !primaryFrame?.url}
                          className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          生成修改图
                        </button>
                        */}
                      </div>
                    </div>
                  </div>
                </div>
              ) : activeTab === "voiceover" ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200"><Mic2 className="h-4 w-4" /> 配音素材</div>
                  {voiceAssets.length ? voiceAssets.map((asset) => (
                    <div key={asset.id} className="rounded-xl border border-white/10 bg-[#242424] p-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Subtitles className="h-4 w-4 text-cyan-300" />
                        {asset.title}
                      </div>
                      <div className="mt-3">
                        <AudioPreviewButton src={asset.url} label="配音试听" />
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.04] p-4 text-sm text-slate-400">
                      <LoaderCircle className="mb-2 h-4 w-4 animate-spin text-cyan-200" />
                      配音生成中，完成后会自动出现在这里。
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200"><Music2 className="h-4 w-4" /> 音乐素材</div>
                  {musicAssets.length ? musicAssets.map((asset) => (
                    <div key={asset.id} className="rounded-lg border border-white/10 bg-white/[0.05] p-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Music2 className="h-4 w-4 text-cyan-300" />
                        {asset.title}
                      </div>
                      <div className="mt-3">
                        <AudioPreviewButton src={asset.url} label="音乐试听" />
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.04] p-4 text-sm text-slate-400">
                      <LoaderCircle className="mb-2 h-4 w-4 animate-spin text-cyan-200" />
                      背景音乐生成中，完成后会自动出现在这里。
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </aside>

        <section className="grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(0,1fr)_290px] overflow-hidden">
          <div className="relative min-h-0 overflow-hidden bg-black/40">
            <div className="grid h-full place-items-center p-6">
              {previewFrame?.url ? (
                <div className="relative h-full max-w-[1040px] overflow-hidden rounded-lg border border-white/10 bg-black">
                  <img src={previewFrame.url} alt="" className="h-full w-full object-contain" />
                  {showPreviewTitle ? (
                    <div className="pointer-events-none absolute inset-x-0 top-[18%] text-center text-4xl font-bold text-yellow-300 [text-shadow:0_2px_2px_#000]">
                      {recipe.title || previewBlock?.title}
                    </div>
                  ) : null}
                  {previewBlock?.script ? (
                    <div className="pointer-events-none absolute inset-x-0 bottom-[16%] px-10 text-center text-2xl font-semibold text-white [text-shadow:0_2px_3px_#000]">
                      {previewBlock.script}
                    </div>
                  ) : null}
                  <button
                    onClick={() => setPreviewPlaying((value) => !value)}
                    className="absolute left-1/2 top-1/2 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70"
                  >
                    {previewPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
                  </button>
                </div>
              ) : (
                <div className="grid aspect-video w-full max-w-[1040px] place-items-center rounded-lg border border-dashed border-white/10 bg-black/35 text-center">
                  <div>
                    <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-cyan-200" />
                    <p className="mt-3 text-sm font-semibold text-white">画面素材生成中</p>
                    <p className="mt-1 text-xs text-slate-500">可以先查看分镜和台词，素材完成后会自动填充。</p>
                  </div>
                </div>
              )}
            </div>

            <div className="absolute bottom-6 right-4 top-4 hidden w-48 rounded-xl border border-white/10 bg-black/70 p-3 lg:block">
              <button className="mx-auto grid size-8 place-items-center rounded-full border border-white/10 text-slate-500">
                <Upload className="h-4 w-4" />
              </button>
              <div className="mt-8 space-y-3">
                {selectableFrames.map((asset, index) => (
                  <button
                    key={asset.id}
                    onClick={() => setSelectedAssetIndex(index)}
                    className={`relative block aspect-video w-full overflow-hidden rounded-lg border-2 ${selectedAssetIndex === index ? "border-cyan-400" : "border-white/10"}`}
                  >
                    <img src={asset.url || ""} alt="" className="h-full w-full object-cover" />
                    {selectedAssetIndex === index ? <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-cyan-400 text-black"><Check className="h-3 w-3" /></span> : null}
                    <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase text-white">IMAGES_TO_IMAGE</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden border-t border-white/10 bg-[hsl(240,2%,8%)]">
            <div className="flex h-14 shrink-0 items-center justify-center border-b border-white/10">
              <div className="inline-flex items-center gap-3 rounded-full bg-slate-950 px-4 py-2 text-xs font-mono text-white">
                <button onClick={() => setPreviewPlaying((value) => !value)} className="grid size-5 place-items-center rounded-full bg-white text-black">
                  {previewPlaying ? <Pause className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 fill-current" />}
                </button>
                {formatTime(previewElapsed)} / {formatTime(previewDuration)}
              </div>
            </div>
            <div ref={timelineScrollRef} onWheel={handleTimelineWheel} className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-3 pb-7 pt-3">
              <div className="relative min-w-max">
                <div
                  className="absolute top-3 z-20 h-[178px] w-px rounded-full bg-orange-400 transition-transform duration-150 ease-linear"
                  style={{ transform: `translateX(${playheadPosition}px)` }}
                >
                  <div className="absolute -top-1 left-1/2 size-3 -translate-x-1/2 rounded-full bg-orange-400" />
                </div>
                <div
                  onClick={handleTimelineClick}
                  className="mb-2 h-7 cursor-pointer"
                  style={{ width: `${timelineContentWidth || 480}px` }}
                >
                  <div className="flex h-full items-end">
                    {blocks.map((block, index) => (
                      <div
                        key={`tick-${block.id}`}
                        className="h-full transition hover:bg-cyan-300/15"
                        style={{ width: `${timelineBlockWidths[index] + (index === blocks.length - 1 ? 0 : timelineBlockGap)}px` }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  {blocks.map((block, index) => {
                    const frame = storyboardGroups[index]?.displayAsset;
                    const selected = selectedBlockIndex === index;
                    return (
                      <button
                        key={block.id}
                        onClick={() => {
                          setPreviewPlaying(false);
                          seekPreview(getStoryboardStartSeconds(previewDurations, index));
                        }}
                        className={`relative h-24 overflow-hidden rounded-md border text-left ${selected ? "border-orange-500" : "border-white/10"}`}
                        style={{ width: `${timelineBlockWidths[index]}px` }}
                      >
                        {frame?.url ? <img src={frame.url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-75" /> : (
                          <div className="absolute inset-0 grid place-items-center bg-white/[0.04]">
                            <LoaderCircle className="h-4 w-4 animate-spin text-cyan-200" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                        <span className="absolute bottom-2 left-2 text-xs font-semibold text-white">分镜{index + 1}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="relative mt-3 h-14" style={{ width: `${timelineContentWidth || 480}px` }}>
                  <span className="absolute left-3 top-1 text-[10px] font-medium text-slate-500">音乐</span>
                  {bgmTracks.length ? bgmTracks.map((track) => (
                    <div
                      key={track.id}
                      className="absolute inset-y-4 flex items-center gap-2 overflow-hidden rounded-md border border-cyan-300/30 bg-cyan-300/15 px-3 text-xs font-medium text-cyan-50"
                      style={{ left: 0, width: `${timelineContentWidth || 480}px` }}
                      title={track.title}
                    >
                      <Music2 className="h-4 w-4 shrink-0 text-cyan-200" />
                      <span className="truncate">{track.title}</span>
                    </div>
                  )) : (
                    <div className="flex h-full items-center gap-2 px-3 pt-3 text-xs text-slate-500">
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin text-cyan-200" />
                      背景音乐生成中
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <Dialog open={exportHistoryOpen} onOpenChange={(open) => {
        setExportHistoryOpen(open);
        if (!open) setPreviewVideoUrl(null);
      }}>
        <DialogContent className="max-w-2xl border-white/10 bg-zinc-950 text-white">
          <DialogHeader>
            <DialogTitle>导出历史</DialogTitle>
            <DialogDescription>当前项目最近的视频导出记录。</DialogDescription>
          </DialogHeader>
          {previewVideoUrl ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setPreviewVideoUrl(null)}
                className="absolute right-0 top-0 z-10 rounded-md bg-black/60 px-3 py-1.5 text-xs text-white hover:bg-black/80"
              >
                返回列表
              </button>
              <video
                src={previewVideoUrl}
                controls
                autoPlay
                className="w-full rounded-lg"
              />
            </div>
          ) : (
            <div className="max-h-[60vh] space-y-3 overflow-y-auto">
              {exportHistoryLoading ? <p className="text-sm text-slate-500">加载中...</p> : null}
              {!exportHistoryLoading && !exportHistory.length ? <p className="text-sm text-slate-500">暂无导出记录</p> : null}
              {exportHistory.map((item) => (
                <div key={item.id} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">{item.status}</p>
                      <p className="mt-1 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
                    </div>
                    <span className="text-xs text-cyan-100">{item.progress}%</span>
                  </div>
                  {item.videoUrl ? (
                    <button
                      type="button"
                      onClick={() => setPreviewVideoUrl(item.videoUrl!)}
                      className="mt-3 inline-flex text-sm text-cyan-200 hover:text-cyan-100"
                    >
                      打开视频
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CreationExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        preset={exportPreset}
        setPreset={setExportPreset}
        resolution={resolution}
        setResolution={setResolution}
        exportState={exportState}
        onStartExport={() => void startExport()}
        primaryFrameUrl={primaryFrame?.url}
        blocks={blocks}
        assets={liveAssets}
      />
    </main>
  );
}
