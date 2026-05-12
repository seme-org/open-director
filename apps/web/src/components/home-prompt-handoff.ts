import { withLocale, type Locale } from "@/i18n.config";

export function homePromptThreadBody(prompt: string) {
  const value = prompt.trim();
  return {
    title: value.slice(0, 80),
    description: value,
  };
}

export function homePromptThreadPath(locale: Locale, threadId: string) {
  return withLocale(locale, `/chat/${threadId}`);
}
