import { describe, expect, it } from "vitest";
import { languageOptions, switchLocalePath } from "./language-dropdown-state";

describe("language dropdown state", () => {
  it("lists all supported languages", () => {
    expect(languageOptions).toEqual([
      { locale: "en", label: "English", nativeLabel: "English" },
      { locale: "zh-CN", label: "Chinese", nativeLabel: "中文" },
    ]);
  });

  it("switches a localized path to the target locale", () => {
    expect(switchLocalePath("/en/templates", "zh-CN")).toBe("/zh-CN/templates");
    expect(switchLocalePath("/zh-CN/chat/thread-1", "en")).toBe("/chat/thread-1");
  });

  it("adds the target locale when the path is not localized", () => {
    expect(switchLocalePath("/templates", "zh-CN")).toBe("/zh-CN/templates");
    expect(switchLocalePath("/", "en")).toBe("/");
  });
});
