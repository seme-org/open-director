"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight, LoaderCircle, Sparkles } from "lucide-react";
import { assertCanSubmit, openSigninDialogForUnauthorized } from "@/components/auth-guard";
import { homePromptThreadBody, homePromptThreadPath } from "@/components/home-prompt-handoff";
import { storePendingPrompt } from "@/components/studio-prompt-handoff";
import { normalizeLocale, type Locale } from "@/i18n.config";
import { withLocale } from "@/i18n.config";

export function HomePrompt({ locale = "en" }: { locale?: Locale }) {
  const router = useRouter();
  const currentLocale = normalizeLocale(locale);
  const t = useTranslations("home");
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    const value = prompt.trim();
    if (!value || isSubmitting) return;
    setIsSubmitting(true);
    setError("");
    try {
      const redirectUrl = withLocale(currentLocale, "/chat");
      if (!(await assertCanSubmit(undefined, redirectUrl))) {
        setIsSubmitting(false);
        return;
      }
      const response = await fetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(homePromptThreadBody(value)),
      });
      if (openSigninDialogForUnauthorized(response, redirectUrl)) {
        setIsSubmitting(false);
        return;
      }
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = await response.json();
      const threadId = String(data.thread?.id ?? "");
      if (!threadId) {
        throw new Error("Thread response did not include an id.");
      }
      storePendingPrompt(window.sessionStorage, threadId, value);
      router.push(homePromptThreadPath(currentLocale, threadId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to start chat.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[760px] overflow-hidden rounded-[30px] border border-white/25 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.06))] p-2 shadow-[0_18px_70px_rgba(13,10,30,0.4)] backdrop-blur-2xl">
      <div className="flex min-h-16 items-center gap-3 px-4">
        <Sparkles className="h-5 w-5 shrink-0 text-amber-300" />
        <input
          type="text"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={t("promptPlaceholder")}
          className="h-12 min-w-0 flex-1 border-0 bg-transparent text-center text-sm font-medium leading-none text-white outline-none placeholder:text-center placeholder:text-white/[0.52] md:text-[15px]"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void submit();
            }
          }}
        />
        <button
          type="button"
          onClick={() => void submit()}
          aria-label={t("startDirecting")}
          disabled={!prompt.trim() || isSubmitting}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/30 bg-[linear-gradient(135deg,#ff8a3d,#ff5db1_48%,#8b5cf6)] text-white shadow-[0_14px_34px_rgba(139,92,246,0.32)] transition hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
        </button>
      </div>
      {error ? <p className="px-4 pb-3 text-left text-xs leading-5 text-rose-200">{error}</p> : null}
    </div>
  );
}
