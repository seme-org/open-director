"use client";

import { useCallback, useRef, useState } from "react";
import {
  Ban,
  CheckCircle,
  Clapperboard,
  Download,
  List,
  Loader2,
  Monitor,
  Proportions,
  Sparkles,
  Type,
  Wand2,
  XCircle,
} from "lucide-react";
import {
  MediaControlBar,
  MediaController,
  MediaFullscreenButton,
  MediaMuteButton,
  MediaPlayButton,
  MediaTimeDisplay,
  MediaTimeRange,
} from "media-chrome/react";
import { ANIMATION_EFFECTS, EFFECT_STYLES, SUBTITLE_STYLES, TITLE_STYLES, TRANSITION_STYLES } from "@/const/styleValue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatExportProgressLabel, type CreationAsset, type CreationBlock, type CreationExportPreset, type CreationExportState } from "./creation-export";

const EXPORT_PRESET_KEY = "video-composition-export-preset";

const labels = {
  exportFullVideo: "Export full video",
  exportFullVideoDescription: "Configure export settings and render the final video.",
  generatingVideoPleaseWait: "Generating video, please wait.",
  exportSuccess: "Export completed.",
  errorDuringExport: "Error during export.",
  resolution: "Resolution",
  generateTitle: "Generate title",
  generateTitleAnimation: "Title animation",
  generateSubtitles: "Generate subtitles",
  generateSubtitleAnimation: "Subtitle animation",
  generateEffect: "Generate effect",
  generateTransition: "Generate transition",
  previewPlaceholder: "PREVIEW",
  close: "Close",
  exporting: "Exporting",
  startExport: "Start export",
  download: "Download",
  upgrade: "Upgrade",
};

function downloadFile(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = "";
  link.rel = "noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function transitionLabel(label: string) {
  return label.replace("transition.", "").replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

function animationLabel(desc: string) {
  return desc.split(".").at(-1) || "Animation";
}

export function CreationExportDialog({
  open,
  onOpenChange,
  preset,
  setPreset,
  resolution,
  setResolution,
  exportState,
  onStartExport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preset: CreationExportPreset;
  setPreset: (preset: CreationExportPreset | ((previous: CreationExportPreset) => CreationExportPreset)) => void;
  resolution: 480 | 720 | 1080;
  setResolution: (resolution: 480 | 720 | 1080) => void;
  exportState: CreationExportState;
  onStartExport: () => void;
  primaryFrameUrl?: string | null;
  blocks: CreationBlock[];
  assets: CreationAsset[];
}) {
  const isFreeUser = false;
  const isResolutionLocked = useCallback((_value: 480 | 720 | 1080) => false, []);
  const handleResolutionSelect = (value: 480 | 720 | 1080) => {
    if (isResolutionLocked(value)) return;
    setResolution(value);
  };

  const setAdvancedParam = (_updates: Record<string, unknown>) => undefined;

  const getQueueHintText = () => "";

  const getStatusIcon = () => {
    switch (exportState.status) {
      case "exporting":
        return <Loader2 className="w-6 h-6 animate-spin text-blue-500" />;
      case "success":
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case "error":
        return <XCircle className="w-6 h-6 text-red-500" />;
      default:
        return <Download className="w-6 h-6 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (exportState.status) {
      case "exporting":
        return "bg-blue-500";
      case "success":
        return "bg-green-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-300";
    }
  };

  const isExporting = exportState.status === "exporting";
  const showPreviewPlaceholder = exportState.status === "idle";
  const exportProgressLabel = formatExportProgressLabel(exportState.progress);

  const sectionIds = ["resolution", "title", "titleAnim", "subtitle", "subtitleAnim", "effects", "transitions"] as const;
  const [activeSection, setActiveSection] = useState<(typeof sectionIds)[number]>("resolution");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({
    resolution: null,
    title: null,
    titleAnim: null,
    subtitle: null,
    subtitleAnim: null,
    effects: null,
    transitions: null,
  });

  const getSectionOffsetTop = useCallback((el: HTMLDivElement) => {
    const root = containerRef.current!;
    const rect = el.getBoundingClientRect();
    const rrect = root.getBoundingClientRect();
    return rect.top - rrect.top + root.scrollTop;
  }, []);

  const scrollToSection = useCallback(
    (id: (typeof sectionIds)[number]) => {
      const el = sectionRefs.current[id];
      const root = containerRef.current;
      if (el && root) {
        const top = getSectionOffsetTop(el);
        root.scrollTo({
          top: Math.max(top - 8, 0),
          behavior: "smooth",
        });
      }
      setActiveSection(id);
    },
    [getSectionOffsetTop],
  );

  const navItems = [
    { id: "resolution", label: labels.resolution, icon: Monitor },
    { id: "title", label: labels.generateTitle, icon: Type },
    { id: "titleAnim", label: labels.generateTitleAnimation, icon: Sparkles },
    { id: "subtitle", label: labels.generateSubtitles, icon: List },
    { id: "subtitleAnim", label: labels.generateSubtitleAnimation, icon: Clapperboard },
    { id: "effects", label: labels.generateEffect, icon: Wand2 },
    { id: "transitions", label: labels.generateTransition, icon: Proportions },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
      <DialogContent
        className="w-[95vw] max-w-[95vw] sm:max-w-[1000px] lg:max-w-[1200px] max-h-[90vh] overflow-auto md:overflow-hidden bg-zinc-900 border-white/20 text-slate-200"
        hideclose={true}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-100">
            {getStatusIcon()}
            {labels.exportFullVideo}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {exportState.status === "idle" && labels.exportFullVideoDescription}
            {exportState.status === "exporting" && labels.generatingVideoPleaseWait}
            {exportState.status === "success" && labels.exportSuccess}
            {exportState.status === "error" && labels.errorDuringExport}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col lg:flex-row gap-4 min-h-0">
          <div className="w-full lg:w-14 shrink-0">
            <div className="flex lg:sticky lg:top-4 flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => scrollToSection(item.id)}
                    title={item.label}
                    aria-label={item.label}
                    className={cn(
                      "h-8 w-8 md:h-10 md:w-10 rounded-md border transition-all flex items-center justify-center shrink-0",
                      activeSection === item.id
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20 border-transparent"
                        : "bg-transparent border-transparent text-zinc-400 hover:bg-white/10 hover:text-zinc-100",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 grid grid-rows-[minmax(0,1fr)_auto] gap-3 min-h-0 max-h-[60vh] lg:max-h-[70vh]">
            <div className="overflow-y-auto pr-1 sm:pr-2 min-h-0" ref={containerRef}>
              <div ref={(el) => { sectionRefs.current.resolution = el; }} data-id="resolution" className="space-y-2 mb-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-zinc-100">{labels.resolution}</div>
                  {isFreeUser && <div className="text-xs text-zinc-400">720p/1080p Upgrade</div>}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[480, 720, 1080].map((value) => {
                    const v = value as 480 | 720 | 1080;
                    const locked = isResolutionLocked(v);
                    const selected = resolution === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => handleResolutionSelect(v)}
                        aria-pressed={selected}
                        aria-disabled={locked}
                        className={cn(
                          "relative h-9 rounded-md border px-2 text-sm font-medium transition-all flex items-center justify-center gap-2",
                          selected
                            ? "bg-blue-600 border-blue-600 text-white ring-2 ring-blue-600/30"
                            : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white",
                          locked && "opacity-50",
                        )}
                      >
                        <span>{v}p</span>
                        {selected && <CheckCircle className="w-4 h-4 text-white absolute -top-2 -right-2 bg-blue-600 rounded-full" />}
                        {locked && (
                          <span className="absolute -top-2 -right-2">
                            <Badge variant="secondary" className="cursor-pointer border border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20">
                              {labels.upgrade}
                            </Badge>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div ref={(el) => { sectionRefs.current.title = el; }} data-id="title" className="space-y-2 mb-6">
                <div className="text-sm font-medium text-zinc-100">{labels.generateTitle}</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div
                    className={cn(
                      "relative aspect-[2.5/1] rounded-lg border-2 cursor-pointer transition-all duration-300 overflow-hidden flex items-center justify-center",
                      !preset.title.enabled
                        ? "ring-2 ring-rose-500 border-transparent bg-rose-950/30 text-rose-400"
                        : "bg-zinc-800 border-zinc-700 hover:border-rose-500 hover:scale-105 text-zinc-400",
                    )}
                    onClick={() => {
                      setPreset((prev) => ({ ...prev, title: { enabled: false, style: undefined } }));
                      setAdvancedParam({ isGenerateTitle: "no", titleStyle: undefined });
                    }}
                  >
                    <Ban className="h-5 w-5" />
                    {!preset.title.enabled && <CheckCircle className="w-4 h-4 text-white absolute top-1 right-1 bg-rose-500 rounded-full" />}
                  </div>
                  {TITLE_STYLES.map((style) => {
                    let styleObj: Record<string, any> = {};
                    try {
                      styleObj = JSON.parse(style.value);
                    } catch {}
                    const selected = preset.title.enabled && preset.title.style === style.value;
                    return (
                      <div
                        key={style.value}
                        className={cn(
                          "relative aspect-[2.5/1] rounded-lg border-2 cursor-pointer transition-all duration-300 overflow-hidden group flex items-center justify-center",
                          selected ? "ring-2 ring-blue-500 border-transparent bg-zinc-800" : "bg-zinc-800 border-zinc-700 hover:border-blue-500 hover:scale-105",
                        )}
                        style={{ backgroundColor: styleObj.backgroundColor || "transparent" }}
                        onClick={() => {
                          setPreset((prev) => ({ ...prev, title: { enabled: true, style: style.value } }));
                          setAdvancedParam({ titleStyle: style.value, isGenerateTitle: "yes" });
                        }}
                      >
                        {selected && <CheckCircle className="w-4 h-4 text-white absolute top-1 right-1 z-20 bg-blue-500 rounded-full" />}
                        <span
                          style={{
                            fontFamily: styleObj.fontFamily ? String(styleObj.fontFamily).split(".")[0] : "sans-serif",
                            color: styleObj.color || "#e2e8f0",
                            fontSize: "24px",
                            fontWeight: styleObj.fontWeight || "bold",
                            WebkitTextStroke:
                              styleObj.stroke && styleObj.strokeThickness ? `${(styleObj.strokeThickness * (24 / (styleObj.fontSize || 90))) / 2}px ${styleObj.stroke}` : undefined,
                            textShadow: styleObj.dropShadow
                              ? `${(styleObj.dropShadowDistance || 2) * (24 / (styleObj.fontSize || 90))}px ${(styleObj.dropShadowDistance || 2) * (24 / (styleObj.fontSize || 90))}px ${(styleObj.dropShadowBlur || 0) * (24 / (styleObj.fontSize || 90))}px ${styleObj.dropShadowColor || "#000000"}`
                              : undefined,
                            paintOrder: "stroke fill",
                            whiteSpace: "nowrap",
                            zIndex: 10,
                          }}
                        >
                          Title Style
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div ref={(el) => { sectionRefs.current.titleAnim = el; }} data-id="titleAnim" className="space-y-2 mb-6">
                <div className="text-sm font-medium text-zinc-100">{labels.generateTitleAnimation}</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div
                    className={cn(
                      "relative p-3 rounded-lg border-2 cursor-pointer transition-all duration-300 flex items-center justify-center",
                      !preset.titleAnimation.enabled
                        ? "ring-2 ring-rose-500 border-transparent bg-rose-950/30 text-rose-400"
                        : "bg-zinc-800 border-zinc-700 hover:border-rose-500 hover:scale-105 text-zinc-400",
                    )}
                    onClick={() => {
                      setPreset((prev) => ({ ...prev, titleAnimation: { enabled: false, name: undefined } }));
                      setAdvancedParam({ isGenerateTitleAnimation: "no", titleAnimation: undefined });
                    }}
                  >
                    <Ban className="h-5 w-5" />
                    {!preset.titleAnimation.enabled && <CheckCircle className="w-4 h-4 text-white absolute top-1 right-1 bg-rose-500 rounded-full" />}
                  </div>
                  {ANIMATION_EFFECTS.title.map((anim) => {
                    const selected = preset.titleAnimation.enabled && preset.titleAnimation.name === anim.name;
                    return (
                      <div
                        key={anim.name}
                        className={cn(
                          "relative p-3 rounded-lg border-2 cursor-pointer transition-all duration-300 flex flex-col items-center justify-center overflow-hidden",
                          selected ? "ring-2 ring-blue-500 border-transparent bg-zinc-800" : "bg-zinc-800 border-zinc-700 hover:border-blue-500 hover:scale-105",
                        )}
                        onClick={() => {
                          setPreset((prev) => ({ ...prev, titleAnimation: { enabled: true, name: anim.name } }));
                          setAdvancedParam({ titleAnimation: anim.name, isGenerateTitleAnimation: "yes" });
                        }}
                      >
                        {selected && <CheckCircle className="w-4 h-4 text-white absolute top-1 right-1 bg-blue-500 rounded-full" />}
                        <span className={cn("font-bold text-sm mb-1 animate__animated animate__infinite text-zinc-100", `animate__${anim.name}`)}>Animation</span>
                        <span className="text-[10px] text-zinc-400 leading-tight text-center">{animationLabel(anim.desc)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div ref={(el) => { sectionRefs.current.subtitle = el; }} data-id="subtitle" className="space-y-2 mb-6">
                <div className="text-sm font-medium text-zinc-100">{labels.generateSubtitles}</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div
                    className={cn(
                      "relative aspect-[2.5/1] rounded-lg border-2 cursor-pointer transition-all duration-300 overflow-hidden flex items-center justify-center",
                      !preset.subtitle.enabled
                        ? "ring-2 ring-rose-500 border-transparent bg-rose-950/30 text-rose-400"
                        : "bg-zinc-800 border-zinc-700 hover:border-rose-500 hover:scale-105 text-zinc-400",
                    )}
                    onClick={() => {
                      setPreset((prev) => ({ ...prev, subtitle: { enabled: false, style: undefined } }));
                      setAdvancedParam({ isGenerateSubtitle: "no", subtitleStyle: undefined });
                    }}
                  >
                    <Ban className="h-5 w-5" />
                    {!preset.subtitle.enabled && <CheckCircle className="w-4 h-4 text-white absolute top-1 right-1 bg-rose-500 rounded-full" />}
                  </div>
                  {SUBTITLE_STYLES.map((style) => {
                    let styleObj: Record<string, any> = {};
                    try {
                      styleObj = JSON.parse(style.value);
                    } catch {}
                    const selected = preset.subtitle.enabled && preset.subtitle.style === style.value;
                    return (
                      <div
                        key={style.value}
                        className={cn(
                          "relative aspect-[2.5/1] rounded-lg border-2 cursor-pointer transition-all duration-300 overflow-hidden group flex items-center justify-center",
                          selected ? "ring-2 ring-blue-500 border-transparent bg-zinc-800" : "bg-zinc-800 border-zinc-700 hover:border-blue-500 hover:scale-105",
                        )}
                        style={{ backgroundColor: styleObj.backgroundColor || "transparent" }}
                        onClick={() => {
                          setPreset((prev) => ({ ...prev, subtitle: { enabled: true, style: style.value } }));
                          setAdvancedParam({ subtitleStyle: style.value, isGenerateSubtitle: "yes" });
                        }}
                      >
                        {selected && <CheckCircle className="w-4 h-4 text-white absolute top-1 right-1 z-20 bg-blue-500 rounded-full" />}
                        <span
                          style={{
                            fontFamily: styleObj.fontFamily ? String(styleObj.fontFamily).split(".")[0] : "sans-serif",
                            color: styleObj.color || "#e2e8f0",
                            fontSize: "20px",
                            fontWeight: styleObj.fontWeight || "bold",
                            WebkitTextStroke:
                              styleObj.stroke && styleObj.strokeThickness ? `${(styleObj.strokeThickness * (20 / (styleObj.fontSize || 60))) / 2}px ${styleObj.stroke}` : undefined,
                            textShadow: styleObj.dropShadow
                              ? `${(styleObj.dropShadowDistance || 2) * (20 / (styleObj.fontSize || 60))}px ${(styleObj.dropShadowDistance || 2) * (20 / (styleObj.fontSize || 60))}px ${(styleObj.dropShadowBlur || 0) * (20 / (styleObj.fontSize || 60))}px ${styleObj.dropShadowColor || "#000000"}`
                              : undefined,
                            paintOrder: "stroke fill",
                            whiteSpace: "nowrap",
                            zIndex: 10,
                          }}
                        >
                          Subtitle Style
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div ref={(el) => { sectionRefs.current.subtitleAnim = el; }} data-id="subtitleAnim" className="space-y-2 mb-6">
                <div className="text-sm font-medium text-zinc-100">{labels.generateSubtitleAnimation}</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div
                    className={cn(
                      "relative p-3 rounded-lg border-2 cursor-pointer transition-all duration-300 flex items-center justify-center",
                      !preset.subtitleAnimation.enabled
                        ? "ring-2 ring-rose-500 border-transparent bg-rose-950/30 text-rose-400"
                        : "bg-zinc-800 border-zinc-700 hover:border-rose-500 hover:scale-105 text-zinc-400",
                    )}
                    onClick={() => {
                      setPreset((prev) => ({ ...prev, subtitleAnimation: { enabled: false, name: undefined } }));
                      setAdvancedParam({ isGenerateSubtitleAnimation: "no", subtitleAnimation: undefined });
                    }}
                  >
                    <Ban className="h-5 w-5" />
                    {!preset.subtitleAnimation.enabled && <CheckCircle className="w-4 h-4 text-white absolute top-1 right-1 bg-rose-500 rounded-full" />}
                  </div>
                  {ANIMATION_EFFECTS.subtitle.map((anim) => {
                    const selected = preset.subtitleAnimation.enabled && preset.subtitleAnimation.name === anim.name;
                    return (
                      <div
                        key={anim.name}
                        className={cn(
                          "relative p-3 rounded-lg border-2 cursor-pointer transition-all duration-300 flex flex-col items-center justify-center overflow-hidden",
                          selected ? "ring-2 ring-blue-500 border-transparent bg-zinc-800" : "bg-zinc-800 border-zinc-700 hover:border-blue-500 hover:scale-105",
                        )}
                        onClick={() => {
                          setPreset((prev) => ({ ...prev, subtitleAnimation: { enabled: true, name: anim.name } }));
                          setAdvancedParam({ subtitleAnimation: anim.name, isGenerateSubtitleAnimation: "yes" });
                        }}
                      >
                        {selected && <CheckCircle className="w-4 h-4 text-white absolute top-1 right-1 bg-blue-500 rounded-full" />}
                        <span className={cn("font-bold text-sm mb-1 animate__animated animate__infinite text-zinc-100", `animate__${anim.name}`)}>Animation</span>
                        <span className="text-[10px] text-zinc-400 leading-tight text-center">{animationLabel(anim.desc)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div ref={(el) => { sectionRefs.current.effects = el; }} data-id="effects" className="space-y-2 mb-6">
                <div className="text-sm font-medium text-zinc-100">{labels.generateEffect}</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div
                    className={cn(
                      "relative rounded-lg border-2 cursor-pointer transition-all duration-300 overflow-hidden flex items-center justify-center aspect-video",
                      !preset.effect.enabled
                        ? "ring-2 ring-rose-500 border-transparent bg-rose-950/30 text-rose-400"
                        : "bg-zinc-800 border-zinc-700 hover:border-rose-500 hover:scale-105 text-zinc-400",
                    )}
                    onClick={() => {
                      setPreset((prev) => ({ ...prev, effect: { enabled: false, style: undefined } }));
                      setAdvancedParam({ isGenerateVideoEffect: "no", videoEffectStyle: undefined });
                    }}
                  >
                    <Ban className="h-5 w-5" />
                    {!preset.effect.enabled && <CheckCircle className="w-4 h-4 text-white absolute top-1 right-1 bg-rose-500 rounded-full" />}
                  </div>
                  {EFFECT_STYLES.map((style) => {
                    const selected = preset.effect.enabled && preset.effect.style === style.value;
                    return (
                      <div
                        key={style.value}
                        className={cn(
                          "relative rounded-lg border-2 cursor-pointer transition-all duration-300 overflow-hidden aspect-video",
                          selected ? "ring-2 ring-blue-500 border-transparent bg-zinc-800" : "bg-zinc-800 border-zinc-700 hover:border-blue-500 hover:scale-105",
                        )}
                        onClick={() => {
                          setPreset((prev) => ({ ...prev, effect: { enabled: true, style: style.value } }));
                          setAdvancedParam({ videoEffectStyle: style.value, isGenerateVideoEffect: "yes" });
                        }}
                      >
                        {selected && <CheckCircle className="w-4 h-4 text-white absolute top-1 right-1 z-20 bg-blue-500 rounded-full" />}
                        <video className="w-full h-full object-cover" src={style.url} muted playsInline loop autoPlay />
                        <div className="absolute bottom-2 left-2 text-xs font-medium bg-black/60 text-white rounded px-2 py-0.5">{style.description}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div ref={(el) => { sectionRefs.current.transitions = el; }} data-id="transitions" className="space-y-2 mb-6">
                <div className="text-sm font-medium text-zinc-100">{labels.generateTransition}</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div
                    className={cn(
                      "relative rounded-lg border-2 cursor-pointer transition-all duration-300 overflow-hidden flex items-center justify-center aspect-video",
                      !preset.transition.enabled
                        ? "ring-2 ring-rose-500 border-transparent bg-rose-950/30 text-rose-400"
                        : "bg-zinc-800 border-zinc-700 hover:border-rose-500 hover:scale-105 text-zinc-400",
                    )}
                    onClick={() => {
                      setPreset((prev) => ({ ...prev, transition: { enabled: false, style: undefined } }));
                      setAdvancedParam({ isGenerateTransition: "no", transitionStyle: undefined });
                    }}
                  >
                    <Ban className="h-5 w-5" />
                    {!preset.transition.enabled && <CheckCircle className="w-4 h-4 text-white absolute top-1 right-1 bg-rose-500 rounded-full" />}
                  </div>
                  {TRANSITION_STYLES.map((style) => {
                    const selected = preset.transition.enabled && preset.transition.style === style.value;
                    return (
                      <div
                        key={style.value}
                        className={cn(
                          "relative rounded-lg border-2 cursor-pointer transition-all duration-300 overflow-hidden aspect-video",
                          selected ? "ring-2 ring-blue-500 border-transparent bg-zinc-800" : "bg-zinc-800 border-zinc-700 hover:border-blue-500 hover:scale-105",
                        )}
                        onClick={() => {
                          setPreset((prev) => ({ ...prev, transition: { enabled: true, style: style.value } }));
                          setAdvancedParam({ transitionStyle: style.value, isGenerateTransition: "yes" });
                        }}
                      >
                        {selected && <CheckCircle className="w-4 h-4 text-white absolute top-1 right-1 z-20 bg-blue-500 rounded-full" />}
                        <video className="w-full h-full object-cover" src={style.url} muted playsInline loop autoPlay />
                        <div className="absolute bottom-2 left-2 text-xs font-medium bg-black/60 text-white rounded px-2 py-0.5">{transitionLabel(style.label)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex flex-row justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white bg-transparent">
                {labels.close}
              </Button>
              <Button onClick={onStartExport} disabled={isExporting} className="flex items-center gap-2 w-full sm:w-auto bg-white text-black hover:bg-zinc-200 shadow-lg shadow-white/10">
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin text-black" /> : <Download className="w-4 h-4" />}
                {isExporting ? labels.exporting : labels.startExport}
              </Button>
            </div>
          </div>

          <div className="w-full lg:w-[360px] shrink-0">
            <div className="lg:sticky lg:top-4 space-y-4">
              <div className="bg-black ring-1 ring-zinc-800 rounded-xl overflow-hidden aspect-[9/16] flex items-center justify-center">
                {showPreviewPlaceholder && (
                  <div className="flex flex-col items-center justify-center text-white/70">
                    <Monitor className="h-8 w-8 mb-2 text-white/70" />
                    <span className="text-xs tracking-widest font-medium">{labels.previewPlaceholder}</span>
                  </div>
                )}
                {exportState.status === "exporting" && (
                  <div className="w-full px-6 text-center text-white space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium text-white/80">
                      <span>{exportState.message}</span>
                      <span>{exportProgressLabel}</span>
                    </div>
                    <Progress value={exportState.progress} className="w-full" indCls={getStatusColor()} />
                    <p className="text-sm">{labels.generatingVideoPleaseWait}</p>
                    {!!getQueueHintText() && <p className="text-xs text-blue-200">{getQueueHintText()}</p>}
                  </div>
                )}

                {exportState.status === "success" && exportState.videoUrl && (
                  <MediaController>
                    <video slot="media" src={exportState.videoUrl} preload="metadata" playsInline className="w-full h-full object-cover" />
                    <MediaControlBar>
                      <MediaPlayButton />
                      <MediaMuteButton />
                      <MediaTimeRange />
                      <MediaFullscreenButton />
                      <div className="absolute top-2 right-2 items-center gap-1 rounded text-white flex text-xs">
                        <MediaTimeDisplay className="rounded px-2 py-0" />
                      </div>
                    </MediaControlBar>
                  </MediaController>
                )}

                {exportState.status === "error" && <div className="px-6 text-center text-red-200 text-sm">{exportState.message}</div>}
              </div>

              {exportState.status === "success" && exportState.videoUrl && (
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadFile(exportState.videoUrl!)}
                    className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white bg-transparent"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {labels.download}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function createInitialExportPreset(): CreationExportPreset {
  return {
    title: { enabled: true, style: TITLE_STYLES[0]?.value },
    titleAnimation: { enabled: true, name: ANIMATION_EFFECTS.title[0]?.name },
    subtitle: { enabled: true, style: SUBTITLE_STYLES[0]?.value },
    subtitleAnimation: { enabled: true, name: ANIMATION_EFFECTS.subtitle[0]?.name },
    effect: { enabled: true, style: EFFECT_STYLES[0]?.value },
    transition: { enabled: true, style: TRANSITION_STYLES[0]?.value },
  };
}

export { EXPORT_PRESET_KEY };
