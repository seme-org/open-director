import Link from "next/link";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AuthForm } from "@/components/auth-form";
import { AppBackdrop } from "@/components/site-shell";
import { normalizeLocale, withLocale } from "@/i18n.config";

export default async function SignUpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const currentLocale = normalizeLocale(locale);
  const t = await getTranslations({ locale: currentLocale, namespace: "signin" });

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <AppBackdrop />
      <section className="relative z-10 grid min-h-screen place-items-center">
        <div className="flex flex-col items-center">
          <Link href={withLocale(currentLocale)} className="inline-flex items-center gap-2 text-2xl font-black tracking-normal text-white">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[linear-gradient(135deg,#ff8a3d,#ff5db1_48%,#8b5cf6)] text-sm shadow-[0_12px_28px_rgba(139,92,246,0.3)]">
              OD
            </span>
            OpenDirector
          </Link>
          <div className="mt-8">
            <Suspense>
              <AuthForm mode="signup" locale={currentLocale} />
            </Suspense>
          </div>
        </div>
      </section>
    </main>
  );
}
