"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSSE } from "@/components/hooks/useSSE";
import type { SSEMessage } from "@/components/types/sse-message";
import { useTranslations } from "next-intl";
import { ArrowUp, CheckCircle2, ChevronDown, ChevronRight, Circle, FileText, FolderOpen, Home, LoaderCircle, Sparkles } from "lucide-react";
import { AppBackdrop } from "@/components/site-shell";
import { Progress } from "@/components/ui/progress";
import { assertCanSubmit, openSigninDialogForUnauthorized } from "@/components/auth-guard";
import { SigninDialog } from "@/components/signin-dialog";
import { DirectorBriefCard } from "@/components/director-brief-card";
import { MarkdownMessage } from "@/components/markdown-message";
import { AudioPreviewButton } from "@/components/audio-preview-button";
import { normalizeLocale, withLocale, type Locale } from "@/i18n.config";
import { storePendingPrompt, takePendingPrompt } from "@/components/studio-prompt-handoff";
import { studioLayoutClasses, studioLayoutWithHeaderClasses } from "@/components/studio-layout";
import { defaultStudioMessages } from "@/components/studio-message-history";
import { buildCreationActionState, buildCreationPreparationSteps, buildPlanningDocumentV2, buildWorkflowActivity, hasCreationImageAssets, latestDataPart, type CreationActionState, type CreationAssetLike, type PlanningDocumentV2 as PlanningDocumentV2Data } from "@/components/studio-view-model";

function messageText(message: SSEMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function RunnerTasksCard({ tasks, taskCount, completedCount, failedCount, running, lastTask, isDone, pct, t, mediaAssetsData }: {
  tasks: Record<string, unknown>[];
  taskCount: number;
  completedCount: number;
  failedCount: number;
  running: Record<string, unknown>[];
  lastTask?: Record<string, unknown>;
  isDone: boolean;
  pct: number;
  t: ReturnType<typeof useTranslations>;
  mediaAssetsData?: Record<string, unknown>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set());
  const completedTaskIdsRef = useRef<Set<string>>(new Set());
  const failedTaskIdsRef = useRef<Set<string>>(new Set());
  const [completedVersion, setCompletedVersion] = useState(0);

  const lastTaskId = lastTask ? String(lastTask.id ?? "") : "";
  const lastTaskStatus = lastTask ? String(lastTask.status ?? "") : "";

  useEffect(() => {
    if (!lastTaskId) return;
    if (lastTaskStatus === "completed") {
      if (!completedTaskIdsRef.current.has(lastTaskId)) {
        completedTaskIdsRef.current = new Set(completedTaskIdsRef.current).add(lastTaskId);
        setCompletedVersion((v) => v + 1);
      }
    } else if (lastTaskStatus === "failed") {
      if (!failedTaskIdsRef.current.has(lastTaskId)) {
        failedTaskIdsRef.current = new Set(failedTaskIdsRef.current).add(lastTaskId);
        setCompletedVersion((v) => v + 1);
      }
    }
  }, [lastTaskId, lastTaskStatus]);

  // Sync completed task IDs from media-assets as fallback when runner-progress
  // events coalesce (multiple tasks completing between emissions).
  useEffect(() => {
    if (!mediaAssetsData) return;
    const assets = Array.isArray(mediaAssetsData.assets) ? mediaAssetsData.assets : [];
    let changed = false;
    const next = new Set(completedTaskIdsRef.current);
    for (const asset of assets) {
      const id = String((asset as Record<string, unknown>).taskId ?? "");
      if (id && !next.has(id)) {
        next.add(id);
        changed = true;
      }
    }
    if (changed) {
      completedTaskIdsRef.current = next;
      setCompletedVersion((v) => v + 1);
    }
  }, [mediaAssetsData]);

  const completedTaskIds = completedTaskIdsRef.current;
  const failedTaskIds = failedTaskIdsRef.current;

  const statusColor = isDone ? "text-emerald-300" : failedCount > 0 ? "text-rose-300" : "text-cyan-300";
  const statusText = isDone ? "完成" : failedCount > 0 ? `${completedCount}/${taskCount} (${failedCount} 失败)` : `${completedCount}/${taskCount}`;

  return (
    <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.05] p-3">
      <button type="button" onClick={() => setExpanded(!expanded)} className="flex w-full items-center gap-2 text-left">
        {expanded ? <ChevronDown className="h-4 w-4 shrink-0 text-cyan-300" /> : <ChevronRight className="h-4 w-4 shrink-0 text-cyan-300" />}
        <span className="text-sm font-semibold text-cyan-200">{t("planning.runnerTasks")}</span>
        <span className={`ml-auto text-xs font-mono ${statusColor}`}>{statusText}</span>
        {!isDone && taskCount > 0 ? (
          <div className="ml-2 h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${pct}%` }} />
          </div>
        ) : null}
      </button>
      {expanded ? (
        <div className="mt-2 space-y-1.5 max-h-80 overflow-y-auto">
          {tasks.map((task) => {
            const taskId = String(task.id);
            const prompt = String(task.prompt ?? "");
            const isRunning = running.some((r) => String(r.id) === taskId);
            const isCompleted = completedTaskIds.has(taskId);
            const isFailed = failedTaskIds.has(taskId);
            const borderColor = isRunning ? "border-cyan-400/40" : isCompleted ? "border-emerald-400/30" : isFailed ? "border-rose-400/30" : "border-white/5";
            const isPromptOpen = expandedPrompts.has(taskId);
            return (
              <div key={taskId} className={`rounded-lg border ${borderColor} bg-black/20`}>
                <button type="button" className="flex w-full items-center gap-2 p-2 text-xs text-left" onClick={() => setExpandedPrompts((prev) => { const next = new Set(prev); if (next.has(taskId)) next.delete(taskId); else next.add(taskId); return next; })}>
                  {isRunning ? <LoaderCircle className="h-3 w-3 shrink-0 animate-spin text-cyan-300" /> : isCompleted ? <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" /> : isFailed ? <Circle className="h-3 w-3 shrink-0 text-rose-400" /> : <Circle className="h-3 w-3 shrink-0 text-slate-600" />}
                  <span className="font-medium text-slate-200">{String(task.sceneTitle ?? "")}</span>
                  <span className="ml-auto text-[10px] text-slate-500">{String(task.tool ?? "")}</span>
                  {prompt ? <ChevronDown className={`h-3 w-3 shrink-0 text-slate-500 transition-transform ${isPromptOpen ? "" : "-rotate-90"}`} /> : null}
                </button>
                {isPromptOpen && prompt ? (
                  <div className="border-t border-white/5 px-2 pb-2 pt-1">
                    <p className="text-[10px] leading-relaxed text-slate-400 break-all">{prompt}</p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function DataPartView({ part, t, onConfirmBrief, confirmingBrief, runnerProgress, mediaAssetsData }: { part: SSEMessage["parts"][number]; t: ReturnType<typeof useTranslations>; onConfirmBrief?: (brief: Record<string, unknown>) => void; confirmingBrief?: boolean; runnerProgress?: Record<string, unknown>; mediaAssetsData?: Record<string, unknown> }) {
  const data = asRecord("data" in part ? part.data : undefined);

  if (part.type === "data-agent-status") {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-slate-300">
        <span className="font-semibold text-white">{String(data.node ?? "agent")}</span>
        <span className="ml-2 text-slate-400">{String(data.status ?? "")}</span>
        {data.error ? <p className="mt-1 text-rose-200">{String(data.error)}</p> : null}
      </div>
    );
  }

  if (part.type === "data-director-brief") {
    return (
      <DirectorBriefCard brief={asRecord(data)} busy={confirmingBrief ?? false} onConfirm={(brief) => onConfirmBrief?.(brief)} />
    );
  }

  if (part.type === "data-recipe") {
    const scenes = Array.isArray(data.scenes) ? data.scenes.map(asRecord) : [];
    const artStyle = asRecord(data.artStyle);
    const bgm = asRecord(data.bgm);
    return (
      <div className="rounded-xl border border-fuchsia-300/20 bg-fuchsia-300/[0.05] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fuchsia-200">{t("planning.storyPlan")}</p>
            <h3 className="mt-1 text-lg font-semibold text-white">{textValue(data.title, t("planning.untitledStory"))}</h3>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-300">
            <span className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1">{textValue(data.intent, t("planning.story"))}</span>
            <span className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1">{textValue(data.language, t("planning.auto"))}</span>
          </div>
        </div>
        <div className="mt-3 grid gap-2 text-sm text-slate-200 sm:grid-cols-2">
          <div className="rounded-lg bg-black/20 p-3">
            <p className="text-xs text-slate-500">{t("planning.audience")}</p>
            <p className="mt-1">{textValue(data.audience)}</p>
          </div>
          <div className="rounded-lg bg-black/20 p-3">
            <p className="text-xs text-slate-500">{t("planning.tone")}</p>
            <p className="mt-1">{textValue(data.tone)}</p>
          </div>
          <div className="rounded-lg bg-black/20 p-3 sm:col-span-2">
            <p className="text-xs text-slate-500">{t("planning.visualStyle")}</p>
            <p className="mt-1">{textValue(artStyle.name)} · {textValue(artStyle.detail)}</p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {scenes.map((scene, index) => (
            <div key={`${textValue(scene.title, "scene")}-${index}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-white">{index + 1}. {textValue(scene.title, t("planning.scene"))}</p>
                <span className="shrink-0 rounded-full bg-white/[0.08] px-2 py-1 text-xs text-slate-400">{textValue(scene.duration)}s</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-200">{textValue(scene.script)}</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">{t("planning.visual")}：{textValue(scene.visualPrompt)}</p>
            </div>
          ))}
        </div>
        {textValue(bgm.prompt) ? <p className="mt-3 text-xs leading-5 text-slate-400">{t("planning.bgm")}：{textValue(bgm.prompt)}</p> : null}
      </div>
    );
  }

  if (part.type === "data-recipe-components") {
    const components = Array.isArray(data.components) ? data.components.map(asRecord) : [];
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.05] p-3">
        <p className="text-sm font-semibold text-white">{t("planning.recipeComponents")}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {components.map((component) => (
            <span key={String(component.name)} className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-xs text-slate-300">
              {String(component.title ?? component.name)}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (part.type === "data-runner-tasks") {
    const tasks = Array.isArray(data.tasks) ? data.tasks.map(asRecord) : [];
    const taskCount = Number(runnerProgress?.taskCount ?? tasks.length);

    // Compute completed count from media-assets as fallback when runner-progress is empty
    const assets = Array.isArray(mediaAssetsData?.assets) ? (mediaAssetsData?.assets as unknown[]).map(asRecord) : [];
    const assetTaskIds = new Set(assets.map((a) => String(a.taskId ?? "")).filter(Boolean));
    const completedFromAssets = tasks.filter((t) => assetTaskIds.has(String(t.id ?? ""))).length;

    const hasLiveProgress = runnerProgress && Object.keys(runnerProgress).length > 0;
    const completedCount = hasLiveProgress ? Number(runnerProgress.completedCount ?? 0) : completedFromAssets;
    const failedCount = hasLiveProgress ? Number(runnerProgress.failedCount ?? 0) : 0;
    const running = hasLiveProgress && Array.isArray(runnerProgress.running) ? runnerProgress.running.map(asRecord) : [];
    const lastTask = hasLiveProgress && runnerProgress.lastTask ? asRecord(runnerProgress.lastTask) : undefined;
    const isDone = taskCount > 0 && completedCount + failedCount >= taskCount;
    const pct = taskCount > 0 ? Math.round((completedCount / taskCount) * 100) : 0;

    return <RunnerTasksCard tasks={tasks} taskCount={taskCount} completedCount={completedCount} failedCount={failedCount} running={running} lastTask={lastTask} isDone={isDone} pct={pct} t={t} mediaAssetsData={mediaAssetsData} />;
  }

  if (part.type === "data-media-assets") {
    const assets = Array.isArray(data.assets) ? data.assets.map(asRecord) : [];
    const images = assets.filter((a) => String(a.type ?? "").toUpperCase() === "IMAGE");
    const voiceAudio = assets.filter((a) => String(a.type ?? "").toUpperCase() === "AUDIO" && String(a.tool) !== "text_to_bgm");
    const bgmAudio = assets.filter((a) => String(a.type ?? "").toUpperCase() === "AUDIO" && String(a.tool) === "text_to_bgm");
    return (
      <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.05] p-3">
        <p className="text-sm font-semibold text-emerald-200">{t("planning.generatedMedia")}</p>
        {images.length > 0 ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {images.map((asset) => (
              <div key={String(asset.assetId)} className="group relative overflow-hidden rounded-lg border border-white/10 bg-black/20">
                <a href={String(asset.url)} target="_blank" rel="noreferrer">
                  <img src={String(asset.url)} alt={String(asset.sceneTitle ?? "")} className="w-full object-cover" loading="lazy" />
                </a>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2">
                  <p className="text-[10px] font-medium text-white">{String(asset.sceneTitle ?? "")}</p>
                  <p className="mt-0.5 line-clamp-2 text-[9px] leading-tight text-slate-300">{String(asset.prompt ?? "")}</p>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {voiceAudio.length > 0 ? (
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {voiceAudio.map((asset) => (
              <div key={String(asset.assetId)} className="flex items-center gap-1.5 rounded-lg bg-black/20 px-2 py-1.5">
                <AudioPreviewButton src={String(asset.url)} label="配音" />
                <span className="truncate text-[10px] text-slate-300">{String(asset.sceneTitle ?? "")}</span>
              </div>
            ))}
          </div>
        ) : null}
        {bgmAudio.length > 0 ? (
          <div className="mt-2 space-y-1.5">
            {bgmAudio.map((asset) => (
              <div key={String(asset.assetId)} className="flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2">
                <AudioPreviewButton src={String(asset.url)} label="BGM" />
                <span className="truncate text-xs text-slate-300">{String(asset.sceneTitle ?? "背景音乐")}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return null;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "completed" || status === "ready") return <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />;
  if (status === "running") return <LoaderCircle className="mt-1 h-4 w-4 shrink-0 animate-spin text-cyan-300" />;
  if (status === "failed") return <Circle className="mt-1 h-4 w-4 shrink-0 text-rose-300" />;
  return <Circle className="mt-1 h-4 w-4 shrink-0 text-slate-700" />;
}

function PlanningV2Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-cyan-300" />
        <h3 className="text-base font-semibold text-cyan-200">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function PlanningV2Bullets({ items, loading = false }: { items: string[]; loading?: boolean }) {
  return (
    <ul className="space-y-2 text-sm leading-7 text-slate-200">
      {items.filter(Boolean).map((item, index) => (
        <li key={`${item}-${index}`} className="flex gap-2">
          {loading ? <LoaderCircle className="mt-1.5 h-4 w-4 shrink-0 animate-spin text-cyan-200" /> : <span className="mt-3 size-1.5 shrink-0 rounded-full bg-slate-400" />}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function PlanningV2LoadingGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="aspect-square overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.04]">
          <div className="h-full w-full animate-pulse bg-gradient-to-br from-white/[0.05] via-cyan-300/[0.08] to-white/[0.03]" />
        </div>
      ))}
    </div>
  );
}

function PlanningV2ImagePlaceholder({ name }: { name: string }) {
  return (
    <figure className="relative aspect-square overflow-hidden rounded-lg border border-cyan-200/20 bg-cyan-300/[0.04]">
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/[0.04] via-cyan-300/[0.12] to-white/[0.03]" />
      <div className="relative flex h-full flex-col items-center justify-center gap-3 px-3 text-center text-cyan-50">
        <LoaderCircle className="h-6 w-6 animate-spin" />
        <span className="text-sm font-semibold">{name}</span>
        <span className="text-xs text-cyan-100/70">生成中</span>
      </div>
    </figure>
  );
}

function PlanningV2ImageGrid({ items }: { items: Array<{ name: string; imageUrl?: string; audioUrl?: string; loading?: boolean }> }) {
  const visibleItems = items.filter((item) => item.imageUrl || item.loading);
  if (!visibleItems.length && items.some((item) => item.loading)) return <PlanningV2LoadingGrid count={Math.min(4, Math.max(1, items.length))} />;
  if (!visibleItems.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {visibleItems.map((item, index) =>
        item.imageUrl ? (
          <figure key={`${item.name}-${item.imageUrl}-${index}`} className="relative aspect-square overflow-hidden rounded-lg border border-white/[0.08] bg-black/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 py-2 text-sm font-semibold text-white">{item.name}</figcaption>
            <div className="absolute bottom-2 right-2">
              <AudioPreviewButton src={item.audioUrl} label="试听" />
            </div>
          </figure>
        ) : (
          <PlanningV2ImagePlaceholder key={`${item.name}-loading-${index}`} name={item.name} />
        ),
      )}
    </div>
  );
}

function PlanningDocumentV2({ document }: { document: PlanningDocumentV2Data }) {
  return (
    <div className="space-y-8">
      <PlanningV2Section title={document.storyOutline.title}>
        <PlanningV2Bullets items={[`${document.storyOutline.contentLabel}：${document.storyOutline.content}`]} />
        <div className="rounded-2xl bg-white/[0.06] p-5">
          <p className="text-sm font-semibold text-white">{document.storyOutline.highlightsTitle}</p>
          <div className="mt-4 space-y-4">
            {document.storyOutline.highlights.map((highlight, index) => (
              <div key={`${highlight.title}-${index}`} className="grid grid-cols-[auto_1fr] gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 text-cyan-100" />
                <div>
                  <p className="text-sm font-semibold text-white">{highlight.title}</p>
                  <p className="mt-2 text-sm leading-7 text-slate-300">{highlight.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </PlanningV2Section>

      <PlanningV2Section title={document.artStyle.title}>
        <PlanningV2Bullets items={[`${document.artStyle.baseLabel}：${document.artStyle.baseStyle}`, document.artStyle.description]} loading={document.artStyle.loading} />
        <PlanningV2ImageGrid items={[{ name: document.artStyle.baseStyle, imageUrl: document.artStyle.imageUrl }]} />
      </PlanningV2Section>

      <PlanningV2Section title="角色列表">
        <PlanningV2Bullets items={document.subjects.map((subject) => `${subject.name}：${subject.description}`)} loading={document.subjects.some((subject) => subject.loading)} />
        <PlanningV2ImageGrid items={document.subjects} />
      </PlanningV2Section>

      <PlanningV2Section title="场景列表">
        <PlanningV2Bullets items={document.scenes.map((scene) => `${scene.name}：${scene.description}`)} loading={document.scenes.some((scene) => scene.loading)} />
        <PlanningV2ImageGrid items={document.scenes} />
      </PlanningV2Section>

      <PlanningV2Section title={document.storyboard.title}>
        <div className="space-y-2">
          <PlanningV2Bullets items={[`场景数量：${document.storyboard.sceneCount}`, `旁白音色：${document.storyboard.voiceRole}`]} loading={document.storyboard.loading} />
          <div className="flex flex-wrap gap-2">
            <AudioPreviewButton src={document.storyboard.voiceAudioUrl} label="旁白试听" />
            <AudioPreviewButton src={document.storyboard.bgmAudioUrl} label="音乐试听" />
          </div>
        </div>
        {document.storyboard.loading ? (
          <div className="rounded-2xl bg-white/[0.05] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <LoaderCircle className="h-4 w-4 animate-spin text-cyan-200" />
              正在拆分场景和分镜
            </div>
            <div className="mt-4 space-y-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-20 animate-pulse rounded-xl bg-white/[0.06]" />
              ))}
            </div>
          </div>
        ) : <div className="space-y-6">
          {document.storyboard.chapters.map((chapter) => (
            <section key={chapter.title} className="rounded-2xl bg-white/[0.05] p-4">
              <h4 className="text-sm font-semibold text-white">{chapter.title} {chapter.meta}</h4>
              <div className="mt-4 space-y-3">
                {chapter.shots.map((shot) => (
                  <div key={`${chapter.title}-${shot.shotNumber}`} className="rounded-xl bg-black/20 p-4">
                    <p className="text-sm font-semibold text-white">分镜 {shot.shotNumber}</p>
                    <div className="mt-2">
                      <AudioPreviewButton src={shot.audioUrl} label="配音试听" />
                    </div>
                    <PlanningV2Bullets
                      items={[
                        `画面描述  ${shot.fields.picture}`,
                        `构图设计  ${shot.fields.composition}`,
                        `运镜调度  ${shot.fields.camera}`,
                        `配音角色  ${shot.fields.voiceRole}`,
                        `台词内容  ${shot.fields.dialogue}`,
                        `画面类型  ${shot.fields.frameType}`,
                      ]}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>}
      </PlanningV2Section>

      {document.mediaAssets.images.length > 0 || document.mediaAssets.audio.length > 0 ? (
        <PlanningV2Section title={document.mediaAssets.title}>
          {document.mediaAssets.images.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-400">图片素材</p>
              <div className="grid grid-cols-4 gap-2">
                {document.mediaAssets.images.map((img) => (
                  <div key={img.assetId} className="group relative overflow-hidden rounded-lg border border-white/10 bg-black/20">
                    <img src={img.url} alt={img.sceneTitle} className="w-full object-cover" loading="lazy" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2">
                      <p className="truncate text-[10px] font-medium text-white">{img.sceneTitle}{img.shotId ? ` · ${img.shotId}` : ""}</p>
                      <p className="mt-0.5 line-clamp-2 text-[9px] leading-tight text-slate-300">{img.prompt || ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {document.mediaAssets.audio.filter((a) => a.tool !== "text_to_bgm").length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-400">配音素材</p>
              <div className="grid grid-cols-2 gap-1.5">
                {document.mediaAssets.audio.filter((a) => a.tool !== "text_to_bgm").map((aud) => (
                  <div key={aud.assetId} className="flex items-center gap-1.5 rounded-lg bg-black/20 px-2 py-1.5">
                    <AudioPreviewButton src={aud.url} label="配音" />
                    <span className="truncate text-[10px] text-slate-300">{aud.sceneTitle}{aud.shotId ? ` · ${aud.shotId}` : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {document.mediaAssets.audio.filter((a) => a.tool === "text_to_bgm").length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-400">背景音乐</p>
              <div className="space-y-1.5">
                {document.mediaAssets.audio.filter((a) => a.tool === "text_to_bgm").map((aud) => (
                  <div key={aud.assetId} className="flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2">
                    <AudioPreviewButton src={aud.url} label="BGM" />
                    <span className="truncate text-xs text-slate-300">{aud.sceneTitle || "背景音乐"}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </PlanningV2Section>
      ) : null}
    </div>
  );
}

function PlanningDocument({
  messages,
  t,
  creationAction,
  creationBusy,
  creationElapsedSeconds,
  onCreationClick,
  onDirectorBriefConfirm,
  confirmingBrief,
}: {
  messages: SSEMessage[];
  t: ReturnType<typeof useTranslations>;
  creationAction: CreationActionState;
  creationBusy: boolean;
  creationElapsedSeconds: number;
  onCreationClick: () => void;
  onDirectorBriefConfirm: (brief: Record<string, unknown>) => void;
  confirmingBrief: boolean;
}) {
  const recipe = latestDataPart(messages, "data-recipe");
  const directorBrief = latestDataPart(messages, "data-director-brief");
  const planningDocument = buildPlanningDocumentV2(t, messages);
  const creationSteps = buildCreationPreparationSteps(t, creationElapsedSeconds);

  if (!textValue(recipe.title)) {
    return (
      <section className="flex h-full flex-col rounded-2xl border border-white/[0.08] bg-zinc-950/70 backdrop-blur-xl">
        <div className="border-b border-white/[0.08] px-6 py-5">
          <p className="text-sm font-semibold text-white">{t("planning.document")}</p>
          <p className="mt-1 text-xs text-slate-500">{t("planning.documentDesc")}</p>
        </div>
        <div className="grid flex-1 place-items-center px-8 text-center text-sm text-slate-500">
          <p>{t("planning.waitingInput")}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-950/70 backdrop-blur-xl">
      <header className="flex items-start justify-between gap-4 border-b border-white/[0.08] px-6 py-5">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-cyan-300" />
            <h2 className="text-lg font-semibold text-white">{textValue(recipe.title, t("planning.untitledStory"))}</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">{t("planning.aiGenerated")}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onCreationClick}
            disabled={creationAction.disabled}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/[0.12] px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/[0.2] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creationAction.loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {creationAction.label}
          </button>
        </div>
      </header>


      {creationBusy ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4 backdrop-blur-md">
          <div className="w-full max-w-3xl rounded-2xl border border-cyan-300/25 bg-slate-950/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl" role="status" aria-live="polite">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <LoaderCircle className="h-4 w-4 animate-spin text-cyan-200" />
                <p className="text-sm font-semibold text-white">{t("creation.preparing")}</p>
              </div>
              <span className="text-xs text-slate-500">{t("common.running")}</span>
            </div>
            <div className="mt-4 space-y-3">
              {creationSteps.map((step) => (
                <div key={step.title} className="grid gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={step.status === "pending" ? "text-sm font-medium text-slate-500" : "text-sm font-medium text-slate-100"}>{step.title}</p>
                      <p className={step.status === "pending" ? "mt-0.5 text-xs leading-5 text-slate-600" : "mt-0.5 text-xs leading-5 text-slate-400"}>{step.detail}</p>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-cyan-100">{step.progress}%</span>
                  </div>
                  <Progress value={step.progress} className="h-1.5 bg-white/[0.08]" indCls={step.status === "completed" ? "bg-emerald-300" : step.status === "running" ? "bg-cyan-300" : "bg-slate-700"} />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-6 py-6">
        <PlanningDocumentV2 document={planningDocument} />
      </div>
    </section>
  );
}

function ProgressPanel({ messages, status, t }: { messages: SSEMessage[]; status: string; t: ReturnType<typeof useTranslations> }) {
  const steps = buildWorkflowActivity(messages, status, t);

  return (
    <div className="space-y-3">
      {steps.map((step) => {
        return (
          <div key={step.title} className="flex items-start gap-3 text-sm text-slate-300">
            <StatusIcon status={step.status} />
            <div>
              <p className={step.status === "pending" ? "font-medium text-slate-600" : "font-medium text-slate-100"}>{step.title}</p>
              <p className={step.status === "pending" ? "mt-1 text-xs leading-5 text-slate-700" : "mt-1 text-xs leading-5 text-slate-400"}>{step.detail}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const SSE_EVENT_TYPE_MAP: Record<string, string> = {
  "agent-status": "data-agent-status",
  "director-brief": "data-director-brief",
  "recipe": "data-recipe",
  "recipe-components": "data-recipe-components",
  "runner-tasks": "data-runner-tasks",
  "runner-progress": "data-runner-progress",
  "media-assets": "data-media-assets",
};

const textAccumulators = new Map<string, string>();

function handleSSEEvent(
  eventType: string,
  data: unknown,
  setMessages: React.Dispatch<React.SetStateAction<SSEMessage[]>>,
) {
  const record = asRecord(data);

  if (eventType === "text-start") {
    const id = textValue(record.id, `t-${Date.now()}`);
    textAccumulators.set(id, "");
    return;
  }

  if (eventType === "text-delta") {
    const id = textValue(record.id);
    const prev = textAccumulators.get(id) ?? "";
    textAccumulators.set(id, prev + textValue(record.delta));
    return;
  }

  if (eventType === "text-end") {
    const id = textValue(record.id);
    const text = textAccumulators.get(id) ?? "";
    textAccumulators.delete(id);
    if (!text) return;

    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === "assistant") {
        const part: SSEMessage["parts"][number] = { type: "text", text };
        const updated = { ...last, parts: [...last.parts, part] };
        return [...prev.slice(0, -1), updated];
      }
      const newMsg: SSEMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        parts: [{ type: "text", text }],
      };
      return [...prev, newMsg];
    });
    return;
  }

  const mappedType = SSE_EVENT_TYPE_MAP[eventType] ?? eventType;

  // Deduplicate recipe events - only keep the latest
  if (mappedType === "data-recipe") {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === "assistant") {
        const filtered = last.parts.filter((p) => p.type !== "data-recipe");
        const part = { type: mappedType, data } as SSEMessage["parts"][number];
        const updated = { ...last, parts: [...filtered, part] };
        return [...prev.slice(0, -1), updated];
      }
      const newMsg: SSEMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        parts: [{ type: mappedType, data } as SSEMessage["parts"][number]],
      };
      return [...prev, newMsg];
    });
    return;
  }

  setMessages((prev) => {
    const last = prev[prev.length - 1];
    if (last?.role === "assistant") {
      const part = { type: mappedType, data } as SSEMessage["parts"][number];
      const updated = { ...last, parts: [...last.parts, part] };
      return [...prev.slice(0, -1), updated];
    }
    const newMsg: SSEMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: "",
      parts: [{ type: mappedType, data } as SSEMessage["parts"][number]],
    };
    return [...prev, newMsg];
  });
}

export function Studio({
  threadId,
  locale = "en",
  initialMessages = defaultStudioMessages,
  hasPageHeader = false,
}: {
  threadId?: string;
  locale?: Locale;
  initialMessages?: SSEMessage[];
  hasPageHeader?: boolean;
}) {
  const router = useRouter();
  const currentLocale = normalizeLocale(locale);
  const t = useTranslations();
  const tStudio = useTranslations("studio");
  const tNav = useTranslations("nav");
  const [input, setInput] = useState("");
  const [activeThread, setActiveThread] = useState(threadId);
  const [creationReady, setCreationReady] = useState(false);
  const [creationBusy, setCreationBusy] = useState(false);
  const [confirmingBrief, setConfirmingBrief] = useState(false);
  const [creationElapsedSeconds, setCreationElapsedSeconds] = useState(0);
  const pendingPromptSentRef = useRef(false);
  const [messages, setMessages] = useState<SSEMessage[]>(initialMessages);

  const { start: startSSE, abort: abortSSE, status: sseStatus } = useSSE({
    url: "/api/agent-chat",
    onEvent(event) {
      try {
        const data = JSON.parse(event.data);
        handleSSEEvent(event.event, data, setMessages);
      } catch { }
    },
    onError(err) {
      console.error("SSE error:", err);
    },
  });

  async function send() {
    if (!input.trim()) return;
    if (!(await assertCanSubmit(undefined, withLocale(currentLocale, activeThread ? `/chat/${activeThread}` : "/chat")))) return;
    const prompt = input.trim();
    setInput("");
    if (!activeThread) {
      const thread = await createThread(prompt, { activate: false });
      storePendingPrompt(window.sessionStorage, thread, prompt);
      router.push(withLocale(currentLocale, `/chat/${thread}`));
      return;
    }
    const userMsg: SSEMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: prompt,
      parts: [{ type: "text", text: prompt }],
    };
    setMessages((prev) => [...prev, userMsg]);
    startSSE(JSON.stringify({
      messages: [...messages, userMsg],
      threadId: activeThread,
      prompt,
    }));
  }

  useEffect(() => {
    if (!activeThread || pendingPromptSentRef.current) return;
    const pendingPrompt = takePendingPrompt(window.sessionStorage, activeThread);
    if (!pendingPrompt) return;
    pendingPromptSentRef.current = true;
    const userMsg: SSEMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: pendingPrompt,
      parts: [{ type: "text", text: pendingPrompt }],
    };
    setMessages((prev) => [...prev, userMsg]);
    startSSE(JSON.stringify({
      messages: [...messages, userMsg],
      threadId: activeThread,
      prompt: pendingPrompt,
    }));
  }, [activeThread]);

  useEffect(() => {
    if (!activeThread) return;
    let cancelled = false;
    void fetch(`/api/thread/${activeThread}/assets`)
      .then((response) => (response.ok ? response.json() : { assets: [] }))
      .then((data) => {
        if (!cancelled) setCreationReady(hasCreationImageAssets((data.assets ?? []) as CreationAssetLike[]));
      })
      .catch(() => {
        if (!cancelled) setCreationReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeThread]);

  useEffect(() => {
    if (!creationBusy) return;
    const timer = window.setInterval(() => {
      setCreationElapsedSeconds((previous) => previous + 0.25);
    }, 250);
    return () => window.clearInterval(timer);
  }, [creationBusy]);

  const displayStatus =
    sseStatus === "streaming"
      ? tStudio("directing")
      : sseStatus === "done"
        ? t("common.idle")
        : sseStatus === "error"
          ? t("common.error")
          : t("common.idle");
  const currentRecipe = latestDataPart(messages, "data-recipe");
  const currentRunnerTasks = latestDataPart(messages, "data-runner-tasks");
  const hasRecipe = Boolean(textValue(currentRecipe.title));
  const hasRunnerTasks = Array.isArray(currentRunnerTasks.tasks) && currentRunnerTasks.tasks.length > 0;
  const creationAction = buildCreationActionState(t, {
    chatStatus: sseStatus,
    creationReady,
    creationBusy,
    hasRecipe,
    hasRunnerTasks,
  });

  async function createThread(title = tStudio("newVideoDirection"), options: { activate?: boolean } = {}) {
    const response = await fetch("/api/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.slice(0, 80), description: title }),
    });
    if (openSigninDialogForUnauthorized(response, withLocale(currentLocale, "/chat"))) {
      throw new Error("Unauthorized");
    }
    const data = await response.json();
    if (options.activate !== false) {
      setActiveThread(data.thread.id);
    }
    return data.thread.id as string;
  }

  async function openCreation() {
    if (!activeThread || creationAction.disabled) return;
    if (!(await assertCanSubmit(undefined, withLocale(currentLocale, `/chat/${activeThread}`)))) return;
    router.push(withLocale(currentLocale, `/creation/${activeThread}`));
  }

  async function confirmDirectorBrief(brief: Record<string, unknown>) {
    if (!activeThread || sseStatus === "streaming") return;
    setConfirmingBrief(true);
    const userMsg: SSEMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: "确认导演简报",
      parts: [{ type: "text", text: "确认导演简报" }],
    };
    setMessages((prev) => [...prev, userMsg]);
    startSSE(JSON.stringify({
      messages: [...messages, userMsg],
      threadId: activeThread,
      confirmDirectorBrief: true,
      directorBrief: brief,
    }));
  }

  // Reset confirmingBrief when SSE finishes
  useEffect(() => {
    if (confirmingBrief && (sseStatus === "done" || sseStatus === "error" || sseStatus === "idle")) {
      setConfirmingBrief(false);
    }
  }, [sseStatus, confirmingBrief]);

  if (!threadId) {
    return (
      <main className={`relative min-h-screen overflow-hidden text-white ${hasPageHeader ? "pt-20" : ""}`}>
        <AppBackdrop />
        <div className={`relative z-10 grid place-items-center px-6 ${hasPageHeader ? "min-h-[calc(100vh-5rem)]" : "min-h-screen"}`}>
          <div className="w-full max-w-3xl">
            <div className="mb-8 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">{tStudio("badge")}</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-normal text-white md:text-5xl">{tStudio("title")}</h1>
              <p className="mt-4 text-sm leading-6 text-slate-400">{tStudio("subtitle")}</p>
            </div>
            <div className="rounded-[30px] border border-white/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.055))] p-2 shadow-[0_18px_70px_rgba(13,10,30,0.4)] backdrop-blur-2xl">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={tStudio("placeholder")}
                className="min-h-32 w-full resize-none border-0 bg-transparent px-5 py-4 text-base font-medium leading-7 text-white outline-none placeholder:text-white/[0.38]"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    void send();
                  }
                }}
              />
              <div className="flex justify-end px-2 pb-2">
                <button
                  onClick={() => void send()}
                  aria-label={t("common.send")}
                  className="grid h-12 w-12 place-items-center rounded-full border border-white/30 bg-[linear-gradient(135deg,#ff8a3d,#ff5db1_48%,#8b5cf6)] text-white shadow-[0_14px_34px_rgba(139,92,246,0.32)] transition hover:scale-[1.03] disabled:opacity-50"
                  disabled={!input.trim()}
                >
                  <ArrowUp className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={hasPageHeader ? studioLayoutWithHeaderClasses.shell : studioLayoutClasses.shell}>
      <AppBackdrop />
      <SigninDialog locale={currentLocale} />
      <div className={hasPageHeader ? studioLayoutWithHeaderClasses.grid : studioLayoutClasses.grid}>
        <aside className="hidden border-r border-white/[0.08] bg-slate-950/15 p-4 backdrop-blur-xl lg:block">
          <Link href={withLocale(currentLocale)} className="grid size-12 place-items-center rounded-full border border-white/20 bg-white/10 text-sm font-bold shadow-[0_0_30px_rgba(0,0,0,0.35)] transition hover:bg-white/20">
            OD
          </Link>
        </aside>

        <section className={hasPageHeader ? studioLayoutWithHeaderClasses.leftPanel : studioLayoutClasses.leftPanel}>
          <header className="flex items-center justify-between border-b border-white/[0.08] bg-slate-950/15 px-5 py-4 backdrop-blur-xl">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">{tStudio("badge")}</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-normal text-white">{tStudio("aiDirectorRoom")}</h1>
            </div>
            <span className="rounded-full border border-white/[0.12] bg-white/[0.06] px-3 py-1 text-sm text-slate-300 backdrop-blur">{displayStatus}</span>
          </header>

          <div className={hasPageHeader ? studioLayoutWithHeaderClasses.messages : studioLayoutClasses.messages}>
            <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-5">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{tStudio("progress")}</p>
              <ProgressPanel messages={messages} status={sseStatus} t={t} />
            </div>
            {messages.map((message) => {
              const text = messageText(message);
              const dataParts = message.parts.filter((part) => part.type.startsWith("data-"));
              const isUser = message.role === "user";
              const runnerProgress = latestDataPart(messages, "data-runner-progress");
              const mediaAssetsData = latestDataPart(messages, "data-media-assets");
              return (
                <div
                  key={message.id}
                  className={`rounded-3xl border p-5 shadow-[0_18px_54px_rgba(0,0,0,0.22)] backdrop-blur-xl ${isUser
                      ? "ml-auto w-fit max-w-[86%] border-white/20 bg-[linear-gradient(135deg,#ff8a3d,#ff5db1_48%,#8b5cf6)] text-white sm:max-w-[74%]"
                      : "mr-auto w-full max-w-[92%] border-white/10 bg-white/[0.07] text-slate-100 sm:max-w-[82%]"
                    }`}
                >
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] opacity-60">{message.role}</p>
                  {text ? <MarkdownMessage>{text}</MarkdownMessage> : null}
                  {dataParts.length > 0 && message.role === "assistant" ? (
                    <div className="mt-3 space-y-3">
                      {dataParts.map((part, index) => {
                        // Skip transient status events - they're shown in ProgressPanel
                        if (part.type === "data-agent-status" || part.type === "data-runner-progress") return null;
                        // Skip duplicate media-assets - only render the latest one
                        if (part.type === "data-media-assets" && dataParts.some((p, i) => i > index && p.type === "data-media-assets")) return null;
                        return <DataPartView key={`${part.type}-${index}`} part={part} t={t} onConfirmBrief={confirmDirectorBrief} confirmingBrief={confirmingBrief} runnerProgress={runnerProgress} mediaAssetsData={mediaAssetsData} />;
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className={hasPageHeader ? studioLayoutWithHeaderClasses.composer : studioLayoutClasses.composer}>
            <div className="mx-auto flex max-w-4xl gap-3 overflow-hidden rounded-[30px] border border-white/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.055))] p-2 shadow-[0_18px_70px_rgba(13,10,30,0.4)] backdrop-blur-2xl">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={tStudio("chatPlaceholder")}
                className="min-h-24 flex-1 resize-none border-0 bg-transparent px-4 py-3 text-sm font-medium leading-6 text-white outline-none placeholder:text-white/[0.38]"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    void send();
                  }
                }}
              />
              <button
                onClick={() => void send()}
                aria-label={t("common.send")}
                className="mt-auto grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/30 bg-[linear-gradient(135deg,#ff8a3d,#ff5db1_48%,#8b5cf6)] text-white shadow-[0_14px_34px_rgba(139,92,246,0.32)] transition hover:scale-[1.03] disabled:opacity-50"
                disabled={!input.trim() || sseStatus === "streaming"}
              >
                <ArrowUp className="h-5 w-5" />
              </button>
            </div>
          </div>
        </section>

        <aside className={hasPageHeader ? studioLayoutWithHeaderClasses.rightPanel : studioLayoutClasses.rightPanel}>
          <PlanningDocument
            messages={messages}
            t={t}
            creationAction={creationAction}
            creationBusy={creationBusy}
            creationElapsedSeconds={creationElapsedSeconds}
            onCreationClick={() => void openCreation()}
            onDirectorBriefConfirm={(brief) => void confirmDirectorBrief(brief)}
            confirmingBrief={confirmingBrief}
          />
        </aside>
      </div>
    </main>
  );
}
