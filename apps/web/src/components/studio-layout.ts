export const studioLayoutClasses = {
  shell: "relative h-screen overflow-hidden text-white",
  grid: "relative z-10 grid h-screen min-h-0 lg:grid-cols-[92px_minmax(420px,0.42fr)_minmax(0,0.58fr)]",
  leftPanel: "flex h-screen min-h-0 min-w-0 flex-col",
  messages: "min-h-0 flex-1 space-y-5 overflow-y-auto p-5 md:p-8",
  composer: "shrink-0 border-t border-white/[0.08] bg-slate-950/20 p-5 backdrop-blur-xl",
  rightPanel: "hidden h-screen min-h-0 overflow-hidden border-l border-white/[0.08] bg-slate-950/20 p-5 text-white backdrop-blur-xl lg:block",
};

export const studioLayoutWithHeaderClasses = {
  shell: "relative h-screen overflow-hidden pt-20 text-white",
  grid: "relative z-10 grid h-[calc(100vh-5rem)] min-h-0 lg:grid-cols-[92px_minmax(420px,0.42fr)_minmax(0,0.58fr)]",
  leftPanel: "flex h-[calc(100vh-5rem)] min-h-0 min-w-0 flex-col",
  messages: studioLayoutClasses.messages,
  composer: studioLayoutClasses.composer,
  rightPanel: "hidden h-[calc(100vh-5rem)] min-h-0 overflow-hidden border-l border-white/[0.08] bg-slate-950/20 p-5 text-white backdrop-blur-xl lg:block",
};
