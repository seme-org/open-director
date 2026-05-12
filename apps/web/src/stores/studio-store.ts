import { create } from "zustand";
import type { Locale } from "@/i18n.config";

type StudioState = {
  activeThreadId?: string;
  setActiveThreadId: (threadId?: string) => void;
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

export const useStudioStore = create<StudioState>((set) => ({
  activeThreadId: undefined,
  setActiveThreadId: (threadId) => set({ activeThreadId: threadId }),
  locale: "en",
  setLocale: (locale) => set({ locale }),
}));
