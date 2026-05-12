import { MarketingPage } from "@/components/site-shell";
import { getTranslations } from "next-intl/server";
import { normalizeLocale } from "@/i18n.config";

export default async function FeaturePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const currentLocale = normalizeLocale(locale);
  const t = await getTranslations({ locale: currentLocale, namespace: "features" });
  const validSlugs = ["idea-to-video", "prompt-to-video", "script-to-video", "story-to-video"];
  const key = validSlugs.includes(slug) ? slug : "idea-to-video";
  return <MarketingPage locale={currentLocale} eyebrow={t("eyebrow")} title={t(`${key}.title`)} body={t(`${key}.body`)} />;
}
