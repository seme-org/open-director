"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { openSigninDialog } from "@/components/auth-guard";
import { normalizeLocale, withLocale, type Locale } from "@/i18n.config";
import { getHeaderUserState, type HeaderSessionStatus, type HeaderSessionUser } from "./header-user-button-state";

type SessionResponse = {
  user: HeaderSessionUser | null;
};

export function HeaderUserButton({ locale = "en" }: { locale?: Locale }) {
  const currentLocale = normalizeLocale(locale);
  const t = useTranslations("auth");
  const [status, setStatus] = useState<HeaderSessionStatus>("loading");
  const [user, setUser] = useState<HeaderSessionUser | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const session = response.ok ? ((await response.json()) as SessionResponse) : { user: null };
        if (cancelled) return;
        setUser(session.user);
        setStatus(session.user?.id ? "authenticated" : "unauthenticated");
      } catch {
        if (!cancelled) {
          setUser(null);
          setStatus("unauthenticated");
        }
      }
    }

    void loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const state = getHeaderUserState(status, user);

  if (state.kind === "loading") {
    return <span className="hidden h-9 w-9 rounded-full bg-white/10 md:inline-block" aria-label={t("loggingIn")} />;
  }

  if (state.kind === "signin") {
    return (
      <button
        type="button"
        onClick={() => openSigninDialog(withLocale(currentLocale, "/chat"))}
        className="hidden rounded-full px-3 py-2 text-sm text-slate-300 transition hover:text-white md:inline"
      >
        {t("signIn") || "Sign in"}
      </button>
    );
  }

  const displayName = state.user.name || state.user.email || t("user");

  return (
    <div ref={menuRef} className="relative hidden md:block">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-white/15 bg-white/10 text-sm font-semibold text-white transition hover:bg-white/15"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        {state.user.image ? (
          <Image src={state.user.image} alt="User profile picture" width={40} height={40} className="h-full w-full object-cover" unoptimized />
        ) : (
          displayName.slice(0, 1).toUpperCase()
        )}
      </button>

      {isOpen ? (
        <div className="absolute right-0 mt-3 w-64 rounded-2xl border border-white/10 bg-slate-950 p-3 text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)]" role="menu">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-white/10 text-sm font-semibold">
              {state.user.image ? (
                <Image src={state.user.image} alt="User profile picture" width={40} height={40} className="h-full w-full object-cover" unoptimized />
              ) : (
                displayName.slice(0, 1).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{displayName}</p>
              <p className="truncate text-xs text-slate-400" title={state.user.email || ""}>
                {state.user.email || ""}
              </p>
            </div>
          </div>
          <div className="my-2 h-px bg-white/10" />
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
            onClick={async () => {
              await fetch("/api/auth/signout", { method: "POST" });
              window.location.href = withLocale(currentLocale);
            }}
            role="menuitem"
          >
            <LogOut className="h-4 w-4" />
            {t("signOut")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
