import Link from "next/link";
import type React from "react";
import { getTranslations } from "next-intl/server";
import { AppBackdrop } from "@/components/site-shell";
import { SpaceThreadCard } from "@/components/space-thread-card";
import { normalizeLocale, withLocale, type Locale } from "@/i18n.config";

type ThreadItem = {
  id: string;
  title: string;
  description?: string | null;
  coverUrl?: string | null;
  updatedAt: Date;
};

function WorkspaceShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-hidden pt-20 text-white">
      <AppBackdrop />
      <div className="relative z-10 min-h-[calc(100vh-5rem)]">{children}</div>
    </main>
  );
}

export async function SpaceWorkspace({ threads, locale = "en" }: { threads: ThreadItem[]; locale?: Locale }) {
  const currentLocale = normalizeLocale(locale);
  const t = await getTranslations({ locale: currentLocale, namespace: "space" });
  const labels = {
    openProject: t("openProject"),
    deleteProject: t("deleteProject"),
    deleteTitle: t("deleteTitle"),
    deleteDescription: t("deleteDescription"),
    cancelDelete: t("cancelDelete"),
    confirmDelete: t("confirmDelete"),
    deleting: t("deleting"),
    deleteError: t("deleteError"),
    defaultDescription: t("defaultDescription"),
  };

  return (
    <WorkspaceShell>
      <section className="mx-auto max-w-[1600px] px-5 py-8 md:px-8">
        <div className="mb-6 flex justify-end">
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-slate-400 backdrop-blur-xl">
            {t("localThreads", { count: threads.length })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {(threads.length ? threads : [{ id: "new", title: t("startFirst"), description: t("startFirstDesc"), coverUrl: null, updatedAt: new Date() }]).map((thread) => (
            <SpaceThreadCard
              key={thread.id}
              thread={{
                ...thread,
                updatedAtLabel: thread.updatedAt.toLocaleDateString("en-US"),
              }}
              href={thread.id === "new" ? withLocale(currentLocale, "/chat") : withLocale(currentLocale, `/chat/${thread.id}`)}
              labels={labels}
              canDelete={thread.id !== "new"}
            />
          ))}
        </div>
      </section>
    </WorkspaceShell>
  );
}
