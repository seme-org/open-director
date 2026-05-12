"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "@/i18n.config";
import { Check, ChevronDown, Languages } from "lucide-react";
import { normalizeLocale, type Locale } from "@/i18n.config";
import { languageOptions } from "./language-dropdown-state";

export function LanguageDropdown({ locale = "en" }: { locale?: Locale }) {
  const currentLocale = normalizeLocale(locale);
  const currentLanguage = languageOptions.find((option) => option.locale === currentLocale) ?? languageOptions[0];
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const changeLocale = (targetLocale: Locale) => {
    setIsOpen(false);
    router.replace(pathname, { locale: targetLocale });
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <Languages size={16} />
        {currentLanguage.nativeLabel}
        <ChevronDown className="h-4 w-4" />
      </button>

      {isOpen ? (
        <div className="absolute right-0 mt-3 w-44 rounded-2xl border border-white/10 bg-slate-950 p-2 text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)]" role="menu">
          {languageOptions.map((option) => {
            const isCurrent = option.locale === currentLocale;
            return (
              <button
                key={option.locale}
                type="button"
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
                onClick={() => changeLocale(option.locale)}
                role="menuitem"
              >
                <span>
                  <span className="block font-medium">{option.nativeLabel}</span>
                  <span className="block text-xs text-slate-500">{option.label}</span>
                </span>
                {isCurrent ? <Check className="h-4 w-4 text-emerald-400" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
