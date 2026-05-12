"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, X } from "lucide-react";
import { closeSigninDialog, signinDialogState, subscribeSigninDialog } from "@/components/auth-guard";
import { normalizeLocale, withLocale, type Locale } from "@/i18n.config";

export function SigninDialog({ locale = "en" }: { locale?: Locale }) {
  const currentLocale = normalizeLocale(locale);
  const t = useTranslations("auth");
  const [, forceRender] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => subscribeSigninDialog(() => forceRender((value) => value + 1)), []);

  if (!signinDialogState.isOpen) return null;

  const redirectUrl = signinDialogState.redirectUrl || withLocale(currentLocale);
  const signinUrl = withLocale(currentLocale, `/signin?redirect=${encodeURIComponent(redirectUrl)}`);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const response = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      closeSigninDialog();
      window.location.href = redirectUrl;
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/65 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="signin-dialog-title">
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-slate-950 p-6 text-white shadow-[0_28px_90px_rgba(0,0,0,0.55)]">
        <button
          type="button"
          onClick={closeSigninDialog}
          aria-label={t("close")}
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="pr-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">OpenDirector</p>
          <h2 id="signin-dialog-title" className="mt-3 text-2xl font-semibold tracking-normal text-white">
            {t("signinToCreate")}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">{t("signinDescription")}</p>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <input
            type="email"
            name="email"
            placeholder={t("emailPlaceholder")}
            required
            className="h-12 w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 text-sm text-white placeholder-slate-500 outline-none transition focus:border-amber-300/50 focus:bg-white/[0.08]"
          />
          <input
            type="password"
            name="password"
            placeholder={t("passwordPlaceholder")}
            required
            className="h-12 w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 text-sm text-white placeholder-slate-500 outline-none transition focus:border-amber-300/50 focus:bg-white/[0.08]"
          />
          {error ? <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-[linear-gradient(135deg,rgba(255,138,61,0.92),rgba(255,93,177,0.9)_48%,rgba(139,92,246,0.94))] text-sm font-semibold text-white shadow-[0_16px_38px_rgba(139,92,246,0.28)] transition hover:scale-[1.01] disabled:opacity-60"
          >
            {loading ? t("loading") : t("signIn")}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
        <Link href={signinUrl} onClick={closeSigninDialog} className="mt-3 flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08]">
          {t("openSigninPage")}
        </Link>
      </div>
    </div>
  );
}
