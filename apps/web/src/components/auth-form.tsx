"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { normalizeLocale, withLocale, type Locale } from "@/i18n.config";

export function AuthForm({ mode, locale = "en" }: { mode: "signin" | "signup"; locale?: Locale }) {
  const searchParams = useSearchParams();
  const [error, setError] = useState(searchParams.get("error") || "");
  const [loading, setLoading] = useState(false);
  const isSignin = mode === "signin";
  const currentLocale = normalizeLocale(locale);
  const t = useTranslations("auth");
  const redirectUrl = searchParams.get("redirect") || withLocale(currentLocale, "/chat");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const name = formData.get("name") as string | null;

    try {
      const endpoint = isSignin ? "/api/auth/signin" : "/api/auth/signup";
      const body: Record<string, string> = { email, password };
      if (!isSignin && name) body.name = name;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      window.location.href = redirectUrl;
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.35)] backdrop-blur-sm">
      <div className="text-center">
        <h1 className="text-xl font-medium text-white">{isSignin ? t("finishSignin") : t("createStudio")}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{t("formDescription")}</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        {!isSignin ? (
          <input
            type="text"
            name="name"
            placeholder={t("namePlaceholder")}
            maxLength={80}
            className="h-12 w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 text-sm text-white placeholder-slate-500 outline-none transition focus:border-amber-300/50 focus:bg-white/[0.08]"
          />
        ) : null}
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
          minLength={isSignin ? 1 : 8}
          className="h-12 w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 text-sm text-white placeholder-slate-500 outline-none transition focus:border-amber-300/50 focus:bg-white/[0.08]"
        />
        <button
          type="submit"
          disabled={loading}
          className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-[linear-gradient(135deg,rgba(255,138,61,0.92),rgba(255,93,177,0.9)_48%,rgba(139,92,246,0.94))] text-sm font-semibold text-white shadow-[0_16px_38px_rgba(139,92,246,0.28)] transition hover:scale-[1.01] hover:shadow-[0_18px_44px_rgba(139,92,246,0.36)] disabled:opacity-60"
        >
          {loading ? t("loading") : isSignin ? t("signIn") : t("signUp")}
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>

      {error ? <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p> : null}

      <p className="mt-4 text-center text-sm text-slate-500">
        {isSignin ? (
          <>
            {t("noAccount")}{" "}
            <Link href={withLocale(currentLocale, `/signup?redirect=${encodeURIComponent(redirectUrl)}`)} className="text-amber-300 hover:underline">
              {t("signUp")}
            </Link>
          </>
        ) : (
          <>
            {t("hasAccount")}{" "}
            <Link href={withLocale(currentLocale, `/signin?redirect=${encodeURIComponent(redirectUrl)}`)} className="text-amber-300 hover:underline">
              {t("signIn")}
            </Link>
          </>
        )}
      </p>

      <p className="mt-5 text-xs leading-5 text-slate-600">
        {t("agreeTerms")}
      </p>
    </div>
  );
}
