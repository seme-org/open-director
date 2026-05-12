"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Clock, FolderOpen, Loader2, Trash2, X } from "lucide-react";

type SpaceThreadCardLabels = {
  openProject: string;
  deleteProject: string;
  deleteTitle: string;
  deleteDescription: string;
  cancelDelete: string;
  confirmDelete: string;
  deleting: string;
  deleteError: string;
  defaultDescription: string;
};

type SpaceThreadCardProps = {
  thread: {
    id: string;
    title: string;
    description?: string | null;
    coverUrl?: string | null;
    updatedAtLabel: string;
  };
  href: string;
  labels: SpaceThreadCardLabels;
  canDelete?: boolean;
};

export function SpaceThreadCard({ thread, href, labels, canDelete = true }: SpaceThreadCardProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteThread() {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/threads/${thread.id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(`Delete failed with ${response.status}`);
      }
      setConfirmOpen(false);
      router.refresh();
    } catch {
      setError(labels.deleteError);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <article className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.07] shadow-[0_18px_54px_rgba(0,0,0,0.22)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.1]">
      <Link href={href} className="block">
        <div className="relative aspect-video overflow-hidden bg-white/[0.04]">
          {thread.coverUrl ? (
            <Image src={thread.coverUrl} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 1280px) 33vw, 20vw" unoptimized className="object-cover transition duration-500 group-hover:scale-105" />
          ) : (
            <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.16),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]">
              <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-black/20">
                <FolderOpen className="h-5 w-5 text-cyan-300" />
              </div>
            </div>
          )}
          <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[11px] text-slate-300 backdrop-blur">
            <Clock className="h-3 w-3" />
            {thread.updatedAtLabel}
          </span>
        </div>
        <div className="p-4">
          <h2 className="line-clamp-1 text-base font-semibold text-white">{thread.title}</h2>
          <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-slate-500">{thread.description || labels.defaultDescription}</p>
        </div>
      </Link>
      <div className="mx-4 mb-4 flex items-center justify-between border-t border-white/10 pt-3 text-sm text-slate-400">
        <Link href={href} className="inline-flex min-w-0 items-center gap-2 transition hover:text-white">
          <span>{labels.openProject}</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
        {canDelete ? (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-rose-500/15 hover:text-rose-200"
            aria-label={labels.deleteProject}
            title={labels.deleteProject}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {confirmOpen && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-950 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-white">{labels.deleteTitle}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{labels.deleteDescription}</p>
              </div>
              <button type="button" onClick={() => setConfirmOpen(false)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-white/10 hover:text-white" aria-label={labels.cancelDelete}>
                <X className="h-4 w-4" />
              </button>
            </div>
            {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmOpen(false)} disabled={isDeleting} className="h-10 rounded-full border border-white/10 px-4 text-sm font-medium text-slate-300 transition hover:bg-white/10 disabled:opacity-50">
                {labels.cancelDelete}
              </button>
              <button type="button" onClick={deleteThread} disabled={isDeleting} className="inline-flex h-10 items-center gap-2 rounded-full bg-rose-500 px-4 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:opacity-60">
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {isDeleting ? labels.deleting : labels.confirmDelete}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </article>
  );
}
