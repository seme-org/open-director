import { createNavigation } from "next-intl/navigation";

export const locales = ["en", "zh-CN"] as const;
export type Locale = (typeof locales)[number];

export function normalizeLocale(value: string | null | undefined): Locale {
  return value === "zh-CN" ? "zh-CN" : "en";
}

export function withLocale(locale: Locale, path = "") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (locale === "en") {
    return normalizedPath;
  }
  return `/${locale}${normalizedPath === "/" ? "" : normalizedPath}`;
}

export const routing = {
  locales,
  defaultLocale: "en",
  localePrefix: "as-needed",
} as const;

export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);
