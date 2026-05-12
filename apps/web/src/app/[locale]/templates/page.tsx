import { MarketingPage } from "@/components/site-shell";
import { getTranslations } from "next-intl/server";
import { normalizeLocale } from "@/i18n.config";

export default async function TemplatesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const currentLocale = normalizeLocale(locale);
  const t = await getTranslations({ locale: currentLocale, namespace: "pages" });
  return (
    <MarketingPage
      locale={currentLocale}
      eyebrow={t("templatesEyebrow")}
      title={t("templatesTitle")}
      body={t("templatesBody")}
    />
  );
}
