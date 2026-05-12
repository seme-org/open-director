import { MarketingPage } from "@/components/site-shell";
import { getTranslations } from "next-intl/server";
import { normalizeLocale } from "@/i18n.config";

export default async function SolutionPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const currentLocale = normalizeLocale(locale);
  const tPages = await getTranslations({ locale: currentLocale, namespace: "pages" });
  const tSolutions = await getTranslations({ locale: currentLocale, namespace: "solutions" });

  const labelKeys: Record<string, string> = {
    educators: "educators",
    "faceless-channels": "facelessChannels",
    "influencers-creators": "influencersCreators",
    "one-person-company": "onePersonCompany",
    "social-media-marketers": "socialMediaMarketers",
  };

  const label = tSolutions(labelKeys[slug] ?? "creativeTeams");
  return (
    <MarketingPage
      locale={currentLocale}
      eyebrow={tPages("solutionEyebrow")}
      title={tPages("solutionTitle", { label })}
      body={tPages("solutionBody")}
    />
  );
}
