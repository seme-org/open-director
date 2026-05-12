"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, LoaderCircle, Play, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createSingleBatchItemPayload,
  singleBatchItemCount,
  type SingleBatchDraftItem,
} from "@/components/batch-workbench-state";
import {
  BATCH_EDGE_TTS_VOICES,
  BATCH_SUBTITLE_ANIMATION_OPTIONS,
  BATCH_SUBTITLE_STYLE_OPTIONS,
  BATCH_TRANSITION_OPTIONS,
} from "@/components/batch-workbench-options";

type BatchSettings = {
  video: {
    aspectRatio: "9:16" | "16:9" | "1:1";
    resolution: 480 | 720 | 1080;
    outputsPerItem: number;
    clipDuration: number;
    concatMode: "random" | "sequential";
    transition: {
      enabled: boolean;
      style?: string;
    };
  };
  materials: {
    source: "local" | "pexels" | "pixabay";
    localDirectory: string;
    uploadedUrls: string[];
    searchMode: "subject" | "keywords" | "script";
  };
  tts: {
    provider: "edge";
    server: "edge";
    voice: string;
    rate: number;
    volume: number;
  };
  bgm: {
    source: "random" | "custom" | "uploaded" | "none";
    directory: string;
    file: string;
    volume: number;
  };
  subtitle: {
    enabled: boolean;
    position: "top" | "center" | "bottom" | "custom";
    customPosition: number;
    fontName: string;
    fontSize: number;
    color: string;
    backgroundColor: boolean | string;
    strokeColor: string;
    strokeWidth: number;
    style?: string;
    animationEnabled: boolean;
    animationName?: string;
  };
  script: {
    language: string;
    audience: string;
  };
  mediaGeneration: {
    aiImages: boolean;
    aiVideos: boolean;
  };
};

type BatchResponse = {
  batch: {
    id: string;
    title: string;
    status: string;
    itemCount: number;
    outputCount: number;
    createdAt?: string;
    items: Array<{
      id: string;
      subject: string | null;
      script: string | null;
      status: string;
      statusDetail?: string | null;
      progress: number;
      error: string | null;
      materials?: Array<{ url: string; provider: string; keyword: string }> | null;
      outputs?: Array<{ id: string; url: string; title: string | null; objectKey?: string | null }>;
    }>;
  };
};

type BatchListResponse = {
  batches: Array<BatchResponse["batch"]>;
};

type DraftItem = {
  subject: string;
  script: string;
  terms: string[];
};

async function readBatchResponse(response: Response) {
  const data = (await response.json()) as BatchResponse | { error?: string };
  if (!response.ok || !("batch" in data)) {
    throw new Error("error" in data && data.error ? data.error : "Batch request failed.");
  }
  return data.batch;
}

const defaultSettings: BatchSettings = {
  video: {
    aspectRatio: "9:16",
    resolution: 720,
    outputsPerItem: 1,
    clipDuration: 3,
    concatMode: "random",
    transition: {
      enabled: false,
      style: undefined,
    },
  },
  materials: {
    source: "local",
    localDirectory: "assets/materials",
    uploadedUrls: [],
    searchMode: "keywords",
  },
  tts: {
    provider: "edge",
    server: "edge",
    voice: "zh-CN-XiaoxiaoNeural",
    rate: 1,
    volume: 1,
  },
  bgm: {
    source: "random",
    directory: "assets/bgm/default",
    file: "",
    volume: 0.2,
  },
  subtitle: {
    enabled: true,
    position: "bottom",
    customPosition: 70,
    fontName: "MicrosoftYaHeiBold.ttc",
    fontSize: 52,
    color: "#FFFFFF",
    backgroundColor: true,
    strokeColor: "#000000",
    strokeWidth: 2,
    style: undefined,
    animationEnabled: true,
    animationName: "fadeInUp",
  },
  script: {
    language: "zh-CN",
    audience: "general short-video audience",
  },
  mediaGeneration: {
    aiImages: false,
    aiVideos: false,
  },
};

function splitTerms(value: string) {
  return value
    .split(/\r?\n|[,，]/)
    .map((term) => term.trim())
    .filter(Boolean);
}

function statusToKey(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

export function BatchWorkbench() {
  const t = useTranslations("batch");
  const [draftItem, setDraftItem] = useState<SingleBatchDraftItem>({
    subject: "唐朝人真的以胖为美吗",
    script: "",
    terms: [],
  });
  const [settings, setSettings] = useState<BatchSettings>(defaultSettings);
  const [batch, setBatch] = useState<BatchResponse["batch"] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadingLocalVideo, setUploadingLocalVideo] = useState(false);
  const [batchToDelete, setBatchToDelete] = useState<BatchResponse["batch"] | null>(null);
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);
  const [draftLoading, setDraftLoading] = useState<"script" | "terms" | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [recentBatches, setRecentBatches] = useState<Array<BatchResponse["batch"]>>([]);

  const itemCount = singleBatchItemCount(draftItem);
  const estimatedOutputs = useMemo(() => itemCount * settings.video.outputsPerItem, [itemCount, settings.video.outputsPerItem]);

  const loadBatch = useCallback(async (batchId: string) => {
    const response = await fetch(`/api/batches/${batchId}`);
    const data = (await response.json()) as BatchResponse | { error?: string };
    if (!response.ok || !("batch" in data)) {
      throw new Error("error" in data && data.error ? data.error : "Batch request failed.");
    }
    setBatch(data.batch);
    setLastSyncedAt(new Date().toLocaleTimeString());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadRecentBatches = async () => {
      try {
        const response = await fetch("/api/batches");
        const data = (await response.json()) as BatchListResponse | { error?: string };
        if (!response.ok || !("batches" in data)) {
          throw new Error("error" in data && data.error ? data.error : "Failed to load batches.");
        }

        if (!cancelled) {
          setRecentBatches(data.batches);
        }
      } catch {
        if (!cancelled) {
          setRecentBatches([]);
        }
      }
    };

    void loadRecentBatches();
    return () => {
      cancelled = true;
    };
  }, []);

  async function startBatch() {
    setLoading(true);
    setError("");
    try {
      const createResponse = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: createSingleBatchItemPayload(draftItem), settings, title: draftItem.subject.trim() || "Batch run" }),
      });
      const created = await readBatchResponse(createResponse);
      setBatch(created);
      setLastSyncedAt(new Date().toLocaleTimeString());
      setRecentBatches((current) => [created, ...current.filter((item) => item.id !== created.id)].slice(0, 8));

      const startResponse = await fetch(`/api/batches/${created.id}/start`, {
        method: "POST",
      });
      const started = await readBatchResponse(startResponse);
      setBatch(started);
      setRecentBatches((current) => [started, ...current.filter((item) => item.id !== started.id)].slice(0, 8));
      setLastSyncedAt(new Date().toLocaleTimeString());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }

  async function generateDraft(kind: "script" | "terms") {
    if (kind === "terms" && !draftItem.script.trim()) {
      setError("Add or generate a script before regenerating keywords.");
      return;
    }

    const items = createSingleBatchItemPayload(kind === "script" ? { ...draftItem, terms: [] } : draftItem);
    if (!items.length) {
      setError("Add at least one video subject or script before generating drafts.");
      return;
    }

    setDraftLoading(kind);
    setError("");
    try {
      const response = await fetch(`/api/batches/draft/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          language: settings.script.language,
          audience: settings.script.audience,
        }),
      });
      const data = (await response.json()) as { items?: DraftItem[]; error?: string };
      if (!response.ok || !data.items) {
        throw new Error(data.error || "Draft generation failed.");
      }

      const [nextItem] = data.items;
      if (nextItem) {
        setDraftItem({
          subject: nextItem.subject,
          script: nextItem.script,
          terms: nextItem.terms,
        });
      }
      setBatch(null);
      setLastSyncedAt(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setDraftLoading(null);
    }
  }

  async function deleteBatch(batchId: string) {
    setDeletingBatchId(batchId);
    try {
      const response = await fetch(`/api/batches/${batchId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Failed to delete batch.");
      }
      setRecentBatches((current) => current.filter((item) => item.id !== batchId));
      if (batch?.id === batchId) {
        setBatch(null);
        setLastSyncedAt(null);
      }
      setBatchToDelete(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setDeletingBatchId(null);
    }
  }

  async function uploadLocalVideos(files: FileList | null) {
    const selectedFiles = Array.from(files || []).filter((file) => file.type.startsWith("video/"));
    if (!selectedFiles.length) return;

    setUploadingLocalVideo(true);
    setError("");
    try {
      const uploadedUrls: string[] = [];
      for (const file of selectedFiles) {
        const initResponse = await fetch("/api/uploads/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type || "video/mp4",
            size: file.size,
            prefix: "batch-local-videos",
          }),
        });
        const upload = (await initResponse.json()) as { uploadId?: string; uploadUrl?: string; publicUrl?: string; error?: string };
        if (!initResponse.ok || !upload.uploadId || !upload.uploadUrl || !upload.publicUrl) {
          throw new Error(upload.error || "Failed to initialize local video upload.");
        }

        const putResponse = await fetch(upload.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "video/mp4" },
          body: file,
        });
        if (!putResponse.ok) throw new Error(`Failed to upload ${file.name}.`);

        await fetch("/api/uploads/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadId: upload.uploadId, title: file.name, type: "VIDEO" }),
        }).catch(() => undefined);
        uploadedUrls.push(upload.publicUrl);
      }

      setSettings((current) => ({
        ...current,
        materials: {
          ...current.materials,
    source: "pexels",
          uploadedUrls: [...current.materials.uploadedUrls, ...uploadedUrls],
        },
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setUploadingLocalVideo(false);
    }
  }

  const activeBatchId = batch?.id;
  const activeBatchStatus = batch?.status;

  useEffect(() => {
    if (!activeBatchId) return;
    if (activeBatchStatus === "COMPLETED" || activeBatchStatus === "FAILED") return;

    let cancelled = false;
    const poll = async () => {
      try {
        await loadBatch(activeBatchId);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : String(caught));
        }
      }
    };

    void poll();
    const interval = window.setInterval(() => {
      void poll();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeBatchId, activeBatchStatus, loadBatch]);

  return (
    <main className="min-h-screen bg-slate-950 px-4 pb-10 pt-24 text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{t("title")}</h1>
            <p className="mt-1 text-sm text-slate-400">{t("subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={startBatch}
            disabled={loading || itemCount === 0}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-emerald-300/30 bg-emerald-300/15 px-4 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-300/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {t("startBatch")}
          </button>
        </div>

        <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <h2 className="text-sm font-semibold text-slate-200">{t("recentBatches")}</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {recentBatches.length ? (
              recentBatches.map((item) => {
                const firstOutput = item.items?.[0]?.outputs?.[0];
                return (
                  <div
                    key={item.id}
                    className="group relative overflow-hidden rounded-lg border border-white/10 bg-black/20 transition hover:border-cyan-300/40 hover:bg-cyan-300/10"
                  >
                    <button
                      type="button"
                      onClick={() => setBatch(item)}
                      className="w-full text-left"
                    >
                      {firstOutput?.url ? (
                        <div className="aspect-video w-full overflow-hidden bg-slate-900">
                          <video
                            src={firstOutput.url}
                            className="h-full w-full object-cover"
                            preload="metadata"
                            muted
                          />
                        </div>
                      ) : (
                        <div className="flex aspect-video w-full items-center justify-center bg-slate-900/50">
                          <span className="text-xs text-slate-600">无预览</span>
                        </div>
                      )}
                      <div className="p-3">
                        <p className="text-sm font-medium text-white">{item.title}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {t(`status${statusToKey(item.status)}` as any)} · {item.itemCount} 条
                        </p>
                        {item.createdAt ? (
                          <p className="mt-1 text-[10px] text-slate-500">
                            {new Date(item.createdAt).toLocaleString()}
                          </p>
                        ) : null}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setBatchToDelete(item);
                      }}
                      className="absolute right-2 top-2 z-10 rounded-md bg-black/60 p-1.5 text-slate-400 opacity-0 transition hover:bg-rose-500/80 hover:text-white group-hover:opacity-100"
                      title={t("deleteBatch")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-500">{t("noRecentBatches")}</p>
            )}
          </div>
        </section>

        {error ? <div className="rounded-md border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-sm text-rose-100">{error}</div> : null}
        {batch ? (
          <div className="rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-sm text-cyan-50">
            <span className="font-semibold">{t(`status${statusToKey(batch.status)}` as any)}.</span>{" "}
            <span className="text-cyan-100/80">{t(`notice${statusToKey(batch.status)}` as any, { count: batch.itemCount, outputs: batch.outputCount })}</span>
            {lastSyncedAt ? <span className="ml-2 text-cyan-100/60">{t("lastSynced", { time: lastSyncedAt })}</span> : null}
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.9fr_1fr]">
          <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <h2 className="text-sm font-semibold text-slate-200">脚本设置</h2>
            <label className="mt-3 block text-sm text-slate-300">
              {t("subject")}
              <Input
                className="mt-2 border-white/10 bg-slate-950/70 text-slate-100 focus-visible:ring-cyan-300"
                value={draftItem.subject}
                onChange={(event) => setDraftItem({ ...draftItem, subject: event.target.value })}
                placeholder="唐朝人真的以胖为美吗"
              />
            </label>
            <button
              type="button"
              onClick={() => void generateDraft("script")}
              disabled={draftLoading !== null || itemCount === 0}
              className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-cyan-300/30 bg-cyan-300/10 px-3 text-xs font-semibold text-cyan-50 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {draftLoading === "script" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {t("generateScripts")}
            </button>
            <label className="mt-3 block text-sm text-slate-300">
              {t("script")}
              <Textarea
                className="mt-2 min-h-[210px] rounded-md border-white/10 bg-slate-950/70 text-slate-100 focus-visible:ring-cyan-300"
                value={draftItem.script}
                onChange={(event) => setDraftItem({ ...draftItem, script: event.target.value })}
                placeholder="Generate a script from the subject, or paste/edit your own script here."
              />
            </label>
            <button
              type="button"
              onClick={() => void generateDraft("terms")}
              disabled={draftLoading !== null || !draftItem.script.trim()}
              className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 text-xs font-semibold text-slate-200 transition hover:border-cyan-300/40 hover:bg-cyan-300/10 hover:text-cyan-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {draftLoading === "terms" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {t("generateKeywords")}
            </button>
            <label className="mt-3 block text-sm text-slate-300">
              {t("searchKeywords")}
              <Textarea
                className="mt-2 min-h-28 rounded-md border-white/10 bg-slate-950/70 text-slate-100 focus-visible:ring-cyan-300"
                value={draftItem.terms.join("\n")}
                onChange={(event) => setDraftItem({ ...draftItem, terms: splitTerms(event.target.value) })}
                placeholder={t("keywordsPlaceholder")}
              />
            </label>
            <p className="mt-3 text-sm text-slate-400">
              {t("itemCount", { count: itemCount, outputs: estimatedOutputs })}
            </p>
            <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("scriptSection")}</h3>
              <label className="block text-sm text-slate-300">
                {t("scriptLanguage")}
                <Select
                  value={settings.script.language || "auto"}
                  onValueChange={(value) => setSettings({ ...settings, script: { ...settings.script, language: value === "auto" ? "" : value } })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">{t("autoDetect")}</SelectItem>
                    <SelectItem value="zh-CN">zh-CN</SelectItem>
                    <SelectItem value="en-US">en-US</SelectItem>
                    <SelectItem value="ja-JP">ja-JP</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="hidden text-sm text-slate-300">
                <Input
                  value={settings.script.audience}
                  onChange={(event) => setSettings({ ...settings, script: { ...settings.script, audience: event.target.value } })}
                />
              </label>
            </div>
          </section>

          <section className="space-y-4 rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <h2 className="text-sm font-semibold text-slate-200">视频设置</h2>

            <div className="space-y-3 border-t border-white/10 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("videoSection")}</h3>
              <label className="block text-sm text-slate-300">
                {t("materialSource")}
                <Select
                  value={settings.materials.source}
                  onValueChange={(value) =>
                    setSettings({ ...settings, materials: { ...settings.materials, source: value as BatchSettings["materials"]["source"] } })
                  }
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pexels">Pexels</SelectItem>
                    <SelectItem value="pixabay">Pixabay</SelectItem>
                    <SelectItem value="local">本地文件</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              {settings.materials.source === "local" ? (
                <div className="rounded-lg border border-dashed border-white/15 bg-slate-950/50 p-4">
                  <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-md bg-white/[0.04] px-4 text-center text-sm text-slate-300 transition hover:bg-white/[0.07]">
                    <UploadCloud className="h-8 w-8 text-slate-400" />
                    <span className="font-medium text-slate-100">{uploadingLocalVideo ? "Uploading..." : "Upload Local Files"}</span>
                    <span className="text-xs text-slate-500">MP4, MOV, AVI, FLV, MKV, MPEG4</span>
                    <input
                      type="file"
                      multiple
                      accept="video/mp4,video/quicktime,video/x-msvideo,video/x-flv,video/x-matroska,video/*"
                      className="sr-only"
                      disabled={uploadingLocalVideo}
                      onChange={(event) => {
                        void uploadLocalVideos(event.target.files);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  {settings.materials.uploadedUrls.length ? (
                    <div className="mt-3 space-y-2">
                      {settings.materials.uploadedUrls.map((url, index) => (
                        <div key={url} className="flex items-center justify-between gap-2 rounded-md bg-black/20 px-3 py-2 text-xs text-slate-300">
                          <span className="truncate">Local video {index + 1}</span>
                          <button
                            type="button"
                            className="text-slate-500 transition hover:text-rose-300"
                            onClick={() =>
                              setSettings({
                                ...settings,
                                materials: {
                                  ...settings.materials,
                                  uploadedUrls: settings.materials.uploadedUrls.filter((item) => item !== url),
                                },
                              })
                            }
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm text-slate-300">
                  {t("aspectRatio")}
                  <Select
                    value={settings.video.aspectRatio}
                    onValueChange={(value) =>
                      setSettings({ ...settings, video: { ...settings.video, aspectRatio: value as BatchSettings["video"]["aspectRatio"] } })
                    }
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="9:16">{t("portrait")}</SelectItem>
                      <SelectItem value="16:9">{t("landscape")}</SelectItem>
                      <SelectItem value="1:1">{t("square")}</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-sm text-slate-300">
                  {t("clipSeconds")}
                  <Select
                    value={String(settings.video.clipDuration)}
                    onValueChange={(value) => setSettings({ ...settings, video: { ...settings.video, clipDuration: Number(value) } })}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                        <SelectItem key={value} value={String(value)}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="block text-sm text-slate-300">
                  {t("concatMode")}
                  <Select
                    value={settings.video.concatMode}
                    onValueChange={(value) => setSettings({ ...settings, video: { ...settings.video, concatMode: value as BatchSettings["video"]["concatMode"] } })}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="random">{t("random")}</SelectItem>
                      <SelectItem value="sequential">{t("sequential")}</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label className="block text-sm text-slate-300">
                  {t("outputsPerItem")}
                  <Select
                    value={String(settings.video.outputsPerItem)}
                    onValueChange={(value) => setSettings({ ...settings, video: { ...settings.video, outputsPerItem: Number(value) } })}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((value) => (
                        <SelectItem key={value} value={String(value)}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-slate-300">{t("transition")}</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {BATCH_TRANSITION_OPTIONS.map((option) => {
                    const selected = option.value === "none" ? !settings.video.transition.enabled : settings.video.transition.style === option.style;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSettings({ ...settings, video: { ...settings.video, transition: { enabled: option.value !== "none", style: option.style } } })}
                        className={`relative flex aspect-video items-center justify-center overflow-hidden rounded-md border bg-black/20 text-left transition ${
                          selected ? "border-cyan-300 ring-2 ring-cyan-300/30" : "border-white/10 hover:border-cyan-300/40"
                        }`}
                      >
                        {option.url ? (
                          <video src={option.url} muted playsInline loop autoPlay className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-sm font-semibold text-slate-200">{option.label}</span>
                        )}
                        {option.url ? <span className="absolute bottom-1 left-1 rounded bg-black/70 px-2 py-0.5 text-[11px] text-white">{option.label}</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-3 border-t border-white/10 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("audioSection")}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm text-slate-300">
                  {t("ttsServer")}
                  <Select
                    value={settings.tts.server}
                    onValueChange={(value) => setSettings({ ...settings, tts: { ...settings.tts, server: value as BatchSettings["tts"]["server"] } })}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="edge">Edge TTS</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label className="block text-sm text-slate-300">
                  {t("voice")}
                  <Select
                    value={settings.tts.voice}
                    onValueChange={(value) => setSettings({ ...settings, tts: { ...settings.tts, voice: value } })}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BATCH_EDGE_TTS_VOICES.map((voice) => (
                        <SelectItem key={voice.value} value={voice.value}>
                          {voice.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm text-slate-300">
                  {t("speechVolume")}
                  <Select
                    value={String(settings.tts.volume)}
                    onValueChange={(value) => setSettings({ ...settings, tts: { ...settings.tts, volume: Number(value) } })}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0.6, 0.8, 1, 1.2, 1.5, 2, 3, 4, 5].map((value) => (
                        <SelectItem key={value} value={String(value)}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="block text-sm text-slate-300">
                  {t("speechRate")}
                  <Select
                    value={String(settings.tts.rate)}
                    onValueChange={(value) => setSettings({ ...settings, tts: { ...settings.tts, rate: Number(value) } })}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.5, 1.8, 2].map((value) => (
                        <SelectItem key={value} value={String(value)}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm text-slate-300">
                  {t("backgroundMusic")}
                  <Select
                    value={settings.bgm.source}
                    onValueChange={(value) => setSettings({ ...settings, bgm: { ...settings.bgm, source: value as BatchSettings["bgm"]["source"] } })}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("bgmNone")}</SelectItem>
                      <SelectItem value="random">{t("bgmRandom")}</SelectItem>
                      <SelectItem value="custom">{t("bgmCustom")}</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label className="block text-sm text-slate-300">
                  {t("bgmVolume")}
                  <Select
                    value={String(settings.bgm.volume)}
                    onValueChange={(value) => setSettings({ ...settings, bgm: { ...settings.bgm, volume: Number(value) } })}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].map((value) => (
                        <SelectItem key={value} value={String(value)}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>
              {settings.bgm.source === "custom" ? (
                <label className="block text-sm text-slate-300">
                  {t("customBgmFile")}
                  <Input
                    className="mt-2 border-white/10 bg-slate-950/70 text-slate-100 focus-visible:ring-cyan-300"
                    value={settings.bgm.file}
                    onChange={(event) => setSettings({ ...settings, bgm: { ...settings.bgm, file: event.target.value } })}
                    placeholder="resource/songs/example.mp3"
                  />
                </label>
              ) : null}
            </div>

          </section>

          <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <h2 className="text-sm font-semibold text-slate-200">字幕设置</h2>
            <div className="mt-3 space-y-3">
              <label className="flex items-center justify-between gap-3 text-sm text-slate-300">
                {t("enableSubtitles")}
                <input
                  type="checkbox"
                  checked={settings.subtitle.enabled}
                  onChange={(event) => setSettings({ ...settings, subtitle: { ...settings.subtitle, enabled: event.target.checked } })}
                  className="h-4 w-4 accent-cyan-300"
                />
              </label>
              <div className="space-y-2">
                <div className="text-sm text-slate-300">{t("subtitleStyle")}</div>
                <div className="grid grid-cols-2 gap-2">
                {BATCH_SUBTITLE_STYLE_OPTIONS.map((option) => {
                  let styleObj: Record<string, any> = {};
                  try {
                    styleObj = JSON.parse(option.style || "{}");
                  } catch {}
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSettings({ ...settings, subtitle: { ...settings.subtitle, enabled: option.value !== "none", style: option.style } })}
                      className={`relative flex aspect-[2.5/1] items-center justify-center overflow-hidden rounded-md border bg-zinc-900 transition ${
                        (option.value === "none" ? !settings.subtitle.enabled : settings.subtitle.enabled && settings.subtitle.style === option.style) ? "border-cyan-300 ring-2 ring-cyan-300/30" : "border-white/10 hover:border-cyan-300/40"
                      }`}
                      style={{ backgroundColor: styleObj.backgroundColor || undefined }}
                    >
                      {option.value === "none" ? (
                        <span className="text-sm font-semibold text-slate-200">{option.label}</span>
                      ) : (
                        <span
                          className="whitespace-nowrap text-sm font-bold"
                          style={{
                            color: styleObj.color || "#e2e8f0",
                            WebkitTextStroke: styleObj.stroke && styleObj.strokeThickness ? `${Math.max(1, styleObj.strokeThickness / 4)}px ${styleObj.stroke}` : undefined,
                            textShadow: styleObj.dropShadow ? `1px 1px 2px ${styleObj.dropShadowColor || "#000"}` : undefined,
                          }}
                        >
                          Subtitle
                        </span>
                      )}
                    </button>
                  );
                })}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-slate-300">Subtitle animation</div>
                <div className="grid grid-cols-2 gap-2">
                  {BATCH_SUBTITLE_ANIMATION_OPTIONS.map((option) => {
                    const selected = option.value === "none" ? !settings.subtitle.animationEnabled : settings.subtitle.animationName === option.name;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSettings({ ...settings, subtitle: { ...settings.subtitle, animationEnabled: option.value !== "none", animationName: option.name } })}
                        className={`h-16 overflow-hidden rounded-md border bg-black/20 p-2 text-center transition ${
                          selected ? "border-cyan-300 ring-2 ring-cyan-300/30" : "border-white/10 hover:border-cyan-300/40"
                        }`}
                      >
                        <span className="flex h-full min-w-0 flex-col items-center justify-center overflow-hidden rounded">
                          {option.name ? (
                            <span className={`animate__animated animate__infinite animate__${option.name} block max-w-full truncate text-sm font-bold text-slate-100`}>Animation</span>
                          ) : (
                            <span className="block max-w-full truncate text-sm font-semibold text-slate-200">{option.label}</span>
                          )}
                          <span className="mt-1 block max-w-full truncate text-[10px] text-slate-500">{option.label}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm text-slate-300">
                  {t("position")}
                  <Select
                    value={settings.subtitle.position}
                    onValueChange={(value) =>
                      setSettings({ ...settings, subtitle: { ...settings.subtitle, position: value as BatchSettings["subtitle"]["position"] } })
                    }
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="top">{t("posTop")}</SelectItem>
                      <SelectItem value="center">{t("posCenter")}</SelectItem>
                      <SelectItem value="bottom">{t("posBottom")}</SelectItem>
                      <SelectItem value="custom">{t("posCustom")}</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label className="block text-sm text-slate-300">
                  {t("fontSize")}
                  <Input
                    type="number"
                    min={24}
                    max={96}
                    className="mt-2 border-white/10 bg-slate-950/70 text-slate-100 focus-visible:ring-cyan-300"
                    value={settings.subtitle.fontSize}
                    onChange={(event) => setSettings({ ...settings, subtitle: { ...settings.subtitle, fontSize: Number(event.target.value) } })}
                  />
                </label>
              </div>
            </div>

            <h3 className="mt-6 text-sm font-semibold text-slate-200">{t("jobQueue")}</h3>
            {batch ? <p className="mt-2 text-xs text-slate-500">{t("refreshNote")}</p> : null}
            <div className="mt-3 space-y-3">
              {batch?.items?.map((item) => {
                const outputs = item.outputs || [];
                const firstOutput = outputs[0];

                return (
                  <div key={item.id} className="rounded-lg bg-black/20 p-3">
                    <p className="text-sm font-medium">{item.subject || item.script || t("untitledItem")}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-cyan-400 transition-all"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-cyan-300">{item.progress}%</span>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-300">
                      {item.statusDetail || t(`detail${statusToKey(item.status)}` as any)}
                    </p>
                    {item.error ? <p className="mt-2 text-xs text-rose-300">{item.error}</p> : null}

                    {item.materials && item.materials.length > 0 ? (
                      <div className="mt-3 space-y-1.5">
                        <p className="text-[10px] font-medium text-slate-400">搜索到的视频素材:</p>
                        <div className="grid grid-cols-3 gap-1.5">
                          {item.materials.map((mat, i) => (
                            <div key={i} className="overflow-hidden rounded border border-white/10 bg-black/30">
                              <video
                                src={mat.url}
                                className="aspect-video w-full object-cover"
                                preload="metadata"
                                controls
                                playsInline
                              />
                              <p className="truncate px-1 py-0.5 text-[9px] text-slate-500">{mat.keyword}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {firstOutput ? (
                      <div className="mt-3 space-y-2">
                        <video
                          src={firstOutput.url}
                          controls
                          preload="metadata"
                          className="aspect-[9/16] max-h-64 w-full rounded-md border border-white/10 bg-slate-950 object-contain"
                        />
                        <div className="space-y-2">
                          {outputs.map((output, outputIndex) => (
                            <a
                              key={output.id || output.url}
                              href={output.url}
                              target="_blank"
                              rel="noreferrer"
                              title={output.objectKey || output.url}
                              className="flex min-h-9 items-center justify-between gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 text-xs font-medium text-cyan-50 transition hover:bg-cyan-300/20"
                            >
                              <span className="truncate">{output.title ? t("outputLabelWithTitle", { index: outputIndex + 1, title: output.title }) : t("outputLabel", { index: outputIndex + 1 })}</span>
                              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              }) ?? <p className="text-sm text-slate-500">{t("noBatchYet")}</p>}
            </div>
          </section>
        </div>
        <Dialog open={Boolean(batchToDelete)} onOpenChange={(open) => {
          if (!open && !deletingBatchId) setBatchToDelete(null);
        }}>
          <DialogContent className="max-w-md border-white/10 bg-zinc-950 text-slate-100">
            <DialogHeader>
              <DialogTitle>确认删除批量任务</DialogTitle>
              <DialogDescription>
                删除后这个批量任务会从列表中移除，已生成的视频文件不会被删除。
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-300">
              <p className="font-medium text-slate-100">{batchToDelete?.title || "Untitled batch"}</p>
              <p className="mt-1 text-xs text-slate-500">
                {batchToDelete?.itemCount ?? 0} items · {batchToDelete?.outputCount ?? 0} outputs
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-white/10 bg-transparent text-slate-200 hover:bg-white/10 hover:text-white"
                disabled={Boolean(deletingBatchId)}
                onClick={() => setBatchToDelete(null)}
              >
                取消
              </Button>
              <Button
                type="button"
                className="bg-rose-500 text-white hover:bg-rose-400"
                disabled={!batchToDelete || Boolean(deletingBatchId)}
                onClick={() => {
                  if (batchToDelete) void deleteBatch(batchToDelete.id);
                }}
              >
                {deletingBatchId ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                删除
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}
