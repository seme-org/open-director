import { HomePage } from "@/components/site-shell";
import { normalizeLocale } from "@/i18n.config";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <HomePage locale={normalizeLocale(locale)} />;
}
