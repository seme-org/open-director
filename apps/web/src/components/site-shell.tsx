import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ArrowRight, CheckCircle2, Github, Sparkles } from "lucide-react";
import { HomePrompt } from "@/components/home-prompt";
import { HeaderUserButton } from "@/components/header-user-button";
import { LanguageDropdown } from "@/components/language-dropdown";
import { SigninDialog } from "@/components/signin-dialog";
import { normalizeLocale, withLocale, type Locale } from "@/i18n.config";
import { TypingHeadline } from "@/components/typing-headline";

const homeSlogans: Record<Locale, string[]> = {
  en: [
    "Turn one prompt into shootable scenes.",
    "Let AI stage the plan, then you refine the cut.",
    "Move from spark to render with a director's rhythm.",
  ],
  "zh-CN": [
    "把一句提示词，拆成可拍的分镜。",
    "让 AI 先搭片场，再交给你定稿。",
    "从灵感到成片，保持导演节奏。",
  ],
};

export async function SiteHeader({ locale = "en" }: { locale?: Locale }) {
  const currentLocale = normalizeLocale(locale);
  const t = await getTranslations({ locale: currentLocale, namespace: "nav" });

  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/5 bg-slate-950/25 backdrop-blur-xl">
      <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-5 md:px-8">
        <Link href={withLocale(currentLocale)} className="flex items-center gap-3 font-semibold">
          <span className="inline-flex items-center gap-2 text-2xl font-black tracking-normal text-white">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[linear-gradient(135deg,#ff8a3d,#ff5db1_48%,#8b5cf6)] text-sm shadow-[0_12px_28px_rgba(139,92,246,0.3)]">
              OD
            </span>
            OpenDirector
          </span>
          <span className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 xl:inline">
            Open Source
          </span>
        </Link>

        <nav className="hidden items-center gap-1 text-sm font-medium text-slate-300 md:flex">
          <Link className="rounded-full px-4 py-2 transition hover:bg-white/[0.08] hover:text-white" href={withLocale(currentLocale, "/space")}>
            {t("space")}
          </Link>
          <Link className="rounded-full px-4 py-2 transition hover:bg-white/[0.08] hover:text-white" href={withLocale(currentLocale, "/batch")}>
            {t("batch")}
          </Link>
          <Link className="rounded-full px-4 py-2 transition hover:bg-white/[0.08] hover:text-white" href={withLocale(currentLocale, "/chat")}>
            {t("studio")}
          </Link>
        </nav>

        <div className="flex items-center gap-2 md:gap-3">
          <LanguageDropdown locale={currentLocale} />
          <a
            href="https://github.com/seme-org/open-director"
            target="_blank"
            rel="noreferrer"
            aria-label="OpenDirector on GitHub"
            className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <Github size={16} />
            <span className="hidden lg:inline">GitHub</span>
          </a>
          <HeaderUserButton locale={currentLocale} />
          <Link
            href={withLocale(currentLocale, "/chat")}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-white/15 bg-[linear-gradient(135deg,#ff8a3d,#ff5db1_48%,#8b5cf6)] px-4 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(139,92,246,0.26)] transition hover:scale-[1.02]"
          >
            {t("start")}
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </header>
  );
}

export function AppBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden app-background">
      <div className="soft-grid absolute inset-0 opacity-70" />
      <div className="grain absolute inset-0 opacity-[0.025] mix-blend-overlay" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.08),transparent_34%)]" />
    </div>
  );
}

export async function HeroFlow({ locale = "en" }: { locale?: Locale }) {
  const currentLocale = normalizeLocale(locale);
  const t = await getTranslations({ locale: currentLocale, namespace: "flow" });

  const flowSteps = [
    { title: t("idea"), image: "/images/home/hero_idea.png", border: "border-amber-400/30" },
    { title: t("brief"), image: "/images/home/hero_brief.png", border: "border-cyan-400/30" },
    { title: t("storyboard"), image: "/images/home/hero_storyboard.png", border: "border-violet-400/30" },
    { title: t("final"), image: "/images/home/hero_final.png", border: "border-emerald-400/30" },
  ];

  return (
    <div className="relative mx-auto w-full max-w-4xl px-2 py-5">
      <div className="absolute left-[9%] right-[9%] top-[44%] h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <div className="relative grid grid-cols-4 gap-3 sm:gap-5">
        {flowSteps.map((step, index) => (
          <div key={step.title} className="flex flex-col items-center gap-3">
            <div className={`relative aspect-square w-full overflow-hidden rounded-2xl border ${step.border} bg-white/[0.08] shadow-2xl backdrop-blur`}>
              <Image src={step.image} alt={step.title} fill className="object-cover" sizes="(max-width: 768px) 25vw, 220px" />
            </div>
            <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500 sm:text-xs">
              <span>{step.title}</span>
              {index < flowSteps.length - 1 ? <ArrowRight className="hidden h-3.5 w-3.5 text-slate-600 sm:block" /> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export async function HomePage({ locale = "en" }: { locale?: Locale }) {
  const currentLocale = normalizeLocale(locale);
  const t = await getTranslations({ locale: currentLocale, namespace: "home" });
  const slogans = [t("title"), ...homeSlogans[currentLocale]];

  return (
    <main className="relative min-h-screen overflow-hidden text-white">
      <AppBackdrop />
      <SigninDialog locale={currentLocale} />
      <div className="relative z-10">
        <SiteHeader locale={currentLocale} />
        <section className="mx-auto flex min-h-screen max-w-7xl flex-col items-center justify-center gap-10 px-5 pb-16 pt-28 text-center md:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/70 px-4 py-1.5 text-sm font-medium text-slate-400 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            {t("badge")}
          </div>
          <div className="max-w-5xl space-y-6">
            <h1 className="mx-auto max-w-5xl text-balance text-5xl font-bold leading-[1.05] tracking-normal text-white sm:text-6xl lg:text-7xl 2xl:text-8xl">
              <TypingHeadline lines={slogans} />
            </h1>
            <p className="mx-auto max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">{t("subtitle")}</p>
            <p className="text-sm font-medium tracking-wide text-slate-500">{t("description")}</p>
          </div>
          <HomePrompt locale={currentLocale} />
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/70" />
              {t("localDocker")}
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/70" />
              {t("sameWorkflow")}
            </span>
          </div>
          <HeroFlow locale={currentLocale} />
        </section>
      </div>
    </main>
  );
}

export async function MarketingPage({
  locale = "en",
  eyebrow,
  title,
  body,
}: {
  locale?: Locale;
  eyebrow: string;
  title: string;
  body: string;
}) {
  const currentLocale = normalizeLocale(locale);
  const t = await getTranslations({ locale: currentLocale, namespace: "nav" });
  const tm = await getTranslations({ locale: currentLocale, namespace: "marketing" });

  return (
    <main className="relative min-h-screen overflow-hidden text-white">
      <AppBackdrop />
      <div className="relative z-10">
        <SiteHeader locale={currentLocale} />
        <section className="mx-auto grid min-h-screen max-w-7xl gap-10 px-5 pb-16 pt-32 md:px-8 lg:grid-cols-[1fr_0.82fr] lg:items-center">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              {eyebrow}
            </p>
            <h1 className="max-w-4xl text-5xl font-bold leading-[1.05] tracking-normal text-white md:text-7xl">{title}</h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-400">{body}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={withLocale(currentLocale, "/chat")}
                className="inline-flex h-12 items-center gap-2 rounded-full border border-white/15 bg-[linear-gradient(135deg,#ff8a3d,#ff5db1_48%,#8b5cf6)] px-5 text-sm font-semibold text-white shadow-[0_16px_38px_rgba(139,92,246,0.28)] transition hover:scale-[1.02]"
              >
                {t("startInStudio")}
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
          <div className="glass-panel overflow-hidden rounded-3xl p-5">
            <HeroFlow locale={currentLocale} />
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[tm("directorBrief"), tm("sceneRecipe"), tm("renderPlan")].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.07] p-4">
                  <p className="text-sm font-semibold text-white">{item}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{tm("keepsStep")}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
