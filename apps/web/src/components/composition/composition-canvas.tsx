"use client";

export function CompositionCanvas() {
  return (
    <div className="relative aspect-video overflow-hidden border-2 border-ink bg-ink shadow-brutal">
      <div className="absolute inset-8 rounded border-4 border-ember" />
      <div className="absolute left-[9%] top-[22%] font-display text-3xl text-paper md:text-4xl">
        OpenDirector composition
      </div>
      <div className="absolute bottom-[19%] left-[10%] rounded bg-paper px-4 py-3 text-lg font-semibold text-ink">
        Scene &gt; Assets &gt; FFCreator
      </div>
    </div>
  );
}
