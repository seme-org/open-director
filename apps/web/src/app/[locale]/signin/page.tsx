import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Sparkles } from "lucide-react";
import { AuthForm } from "@/components/auth-form";
import { AppBackdrop } from "@/components/site-shell";
import { normalizeLocale, withLocale } from "@/i18n.config";

export default async function SignInPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const currentLocale = normalizeLocale(locale);
  const t = await getTranslations({ locale: currentLocale, namespace: "signin" });
  const tFlow = await getTranslations({ locale: currentLocale, namespace: "flow" });

  const flowSteps = [
    { title: tFlow("idea"), image: "/images/home/hero_idea.png" },
    { title: tFlow("brief"), image: "/images/home/hero_brief.png" },
    { title: tFlow("storyboard"), image: "/images/home/hero_storyboard.png" },
    { title: tFlow("final"), image: "/images/home/hero_final.png" },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <AppBackdrop />
      <section className="relative z-10 grid min-h-screen grid-cols-1 md:grid-cols-2">
        <div className="grid min-h-screen grid-rows-[auto_1fr]">
          <div className="flex items-start justify-start p-5 md:p-12">
            <Link href={withLocale(currentLocale)} className="inline-flex items-center gap-2 text-2xl font-black tracking-normal text-white">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[linear-gradient(135deg,#ff8a3d,#ff5db1_48%,#8b5cf6)] text-sm shadow-[0_12px_28px_rgba(139,92,246,0.3)]">
                OD
              </span>
              OpenDirector
            </Link>
          </div>
          <div className="flex items-center justify-center px-5 pb-12 md:px-12">
            <Suspense>
              <AuthForm mode="signin" locale={currentLocale} />
            </Suspense>
          </div>
        </div>

        <div className="relative hidden min-h-screen overflow-hidden bg-slate-900 md:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,138,61,0.24),transparent_32%),radial-gradient(circle_at_78%_30%,rgba(139,92,246,0.32),transparent_36%),linear-gradient(180deg,#111827,#020617)]" />
          <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:64px_64px]" />
          <div className="relative z-10 flex h-full flex-col justify-center px-12 xl:px-20">
            <div className="mb-8 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-4 py-2 text-sm font-medium text-slate-300 backdrop-blur-xl">
              <Sparkles className="h-4 w-4 text-amber-300" />
              {t("eyebrow")}
            </div>
            <h2 className="max-w-xl text-5xl font-semibold leading-tight tracking-normal text-white xl:text-6xl">
              {t("title")}
            </h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-400">
              {t("subtitle")}
            </p>

            <div className="mt-10 grid max-w-2xl grid-cols-2 gap-4">
              {flowSteps.map((item, index) => (
                <div key={item.title} className="group rounded-3xl border border-white/10 bg-white/[0.07] p-3 shadow-[0_18px_54px_rgba(0,0,0,0.24)] backdrop-blur-xl">
                  <div className="relative aspect-[16/10] overflow-hidden rounded-2xl">
                    <Image src={item.image} alt={item.title} fill className="object-cover transition duration-500 group-hover:scale-105" sizes="320px" />
                  </div>
                  <div className="mt-3 flex items-center justify-between px-1 text-sm font-semibold text-white">
                    <span>0{index + 1}. {item.title}</span>
                    {index < 3 ? <ArrowRight className="h-4 w-4 text-slate-500" /> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
