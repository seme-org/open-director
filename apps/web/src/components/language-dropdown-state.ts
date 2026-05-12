import { locales, type Locale } from "@/i18n.config";

export const languageOptions: Array<{ locale: Locale; label: string; nativeLabel: string }> = [
  { locale: "en", label: "English", nativeLabel: "English" },
  { locale: "zh-CN", label: "Chinese", nativeLabel: "中文" },
];

export function switchLocalePath(pathname: string, targetLocale: Locale) {
  const segments = pathname.split("/").filter(Boolean);
  const [, ...rest] = segments;
  const hasLocalePrefix = locales.includes(segments[0] as Locale);
  const targetSegments = hasLocalePrefix ? rest : segments;
  if (targetLocale === "en") {
    return targetSegments.length ? `/${targetSegments.join("/")}` : "/";
  }
  targetSegments.unshift(targetLocale);
  return `/${targetSegments.join("/")}`;
}
