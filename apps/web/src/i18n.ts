import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { locales } from "./i18n.config";

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale;

  if (!hasLocale(locales, locale)) {
    notFound();
  }

  return {
    locale,
    messages: (await import(`../locales/${locale}.json`)).default,
  };
});

