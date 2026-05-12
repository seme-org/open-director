import { MarketingPage } from "@/components/site-shell";
import { getTranslations } from "next-intl/server";
import { normalizeLocale } from "@/i18n.config";

export default async function AssetPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const currentLocale = normalizeLocale(locale);
  const t = await getTranslations({ locale: currentLocale, namespace: "pages" });
  return <MarketingPage locale={currentLocale} eyebrow={t("assetsEyebrow")} title={`Asset ${id}`} body={t("assetsBody")} />;
}
