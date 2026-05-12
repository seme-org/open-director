import { notFound, redirect } from "next/navigation";
import { Studio } from "@/components/studio";
import { SiteHeader } from "@/components/site-shell";
import { toStudioInitialMessages } from "@/components/studio-message-history";
import { prisma } from "@/server/db/prisma";
import { normalizeLocale, withLocale } from "@/i18n.config";
import { getCurrentUser } from "@/server/auth/session";

export default async function ChatThreadPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const currentLocale = normalizeLocale(locale);
  const user = await getCurrentUser();
  if (!user) redirect(withLocale(currentLocale, "/signin"));
  const [thread, messages, assets] = await Promise.all([
    prisma.thread.findFirst({
      where: { id, isDeleted: false },
      select: { id: true },
    }),
    prisma.message.findMany({
      where: { threadId: id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        role: true,
        content: true,
        parts: true,
      },
    }),
    prisma.asset.findMany({
      where: { threadId: id },
      orderBy: { createdAt: "asc" },
      select: { id: true, title: true, type: true, url: true, metadata: true },
    }),
  ]);

  if (!thread) notFound();

  return (
    <>
      <SiteHeader locale={currentLocale} />
      <Studio threadId={id} locale={currentLocale} initialMessages={toStudioInitialMessages(messages, assets.map((asset) => ({ ...asset, type: asset.type })))} hasPageHeader />
    </>
  );
}
