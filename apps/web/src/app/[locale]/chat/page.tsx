import { redirect } from "next/navigation";
import { Studio } from "@/components/studio";
import { SiteHeader } from "@/components/site-shell";
import { normalizeLocale, withLocale } from "@/i18n.config";
import { getCurrentUser } from "@/server/auth/session";

export default async function ChatPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const currentLocale = normalizeLocale(locale);
  const user = await getCurrentUser();
  if (!user) redirect(withLocale(currentLocale, "/signin"));
  return (
    <>
      <SiteHeader locale={currentLocale} />
      <Studio locale={currentLocale} hasPageHeader />
    </>
  );
}
