import { redirect } from "next/navigation";
import { SpaceWorkspace } from "@/components/workspace-pages";
import { SiteHeader } from "@/components/site-shell";
import { normalizeLocale, withLocale } from "@/i18n.config";
import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";

export const dynamic = "force-dynamic";

export default async function SpacePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const currentLocale = normalizeLocale(locale);
  const user = await getCurrentUser();
  if (!user) redirect(withLocale(currentLocale, "/signin"));
  const threads = user
    ? await prisma.thread
        .findMany({
          where: { isDeleted: false, userId: user.id },
          orderBy: { updatedAt: "desc" },
          take: 18,
          select: {
            id: true,
            title: true,
            description: true,
            coverUrl: true,
            updatedAt: true,
          },
        })
        .catch(() => [])
    : [];

  return (
    <>
      <SiteHeader locale={currentLocale} />
      <SpaceWorkspace threads={threads} locale={currentLocale} />
    </>
  );
}
