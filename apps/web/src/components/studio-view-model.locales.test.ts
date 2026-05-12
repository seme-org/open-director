import { describe, expect, it } from "vitest";
import en from "../../locales/en.json";
import zhCN from "../../locales/zh-CN.json";

function flattenMessages(messages: Record<string, unknown>, prefix = ""): Record<string, string> {
  return Object.fromEntries(
    Object.entries(messages).flatMap(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return Object.entries(flattenMessages(value as Record<string, unknown>, path));
      }
      return [[path, String(value)]];
    }),
  );
}

describe("studio view model locale coverage", () => {
  it("provides every planning placeholder message in each supported locale", () => {
    const requiredKeys = ["workflow.subjectsAndStylePending", "workflow.scenesAndStoryboardPending"];
    const locales = {
      en: flattenMessages(en),
      "zh-CN": flattenMessages(zhCN),
    };

    for (const [locale, messages] of Object.entries(locales)) {
      expect(Object.keys(messages), `${locale} locale`).toEqual(expect.arrayContaining(requiredKeys));
    }
  });
});
