import { redirect } from "next/navigation";
import { BatchWorkbench } from "@/components/batch-workbench";
import { SiteHeader } from "@/components/site-shell";
import { normalizeLocale, withLocale } from "@/i18n.config";
import { getCurrentUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function BatchPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const currentLocale = normalizeLocale(locale);
  const user = await getCurrentUser();
  if (!user) redirect(withLocale(currentLocale, "/signin"));

  return (
    <>
      <SiteHeader locale={currentLocale} />
      <BatchWorkbench />
    </>
  );
}
