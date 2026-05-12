import { describe, expect, it } from "vitest";
import { resolveBatchScript, resolveBatchTerms } from "./run";

describe("batch run resolution", () => {
  it("uses explicit script before subject", () => {
    expect(resolveBatchScript({ subject: "主题", script: "完整脚本" })).toBe("完整脚本");
  });

  it("does not use the subject as a fallback script", () => {
    expect(resolveBatchScript({ subject: "主题", script: "" })).toBe("");
  });

  it("uses explicit terms before subject fallback", () => {
    expect(resolveBatchTerms({ subject: "主题", resolvedScript: "脚本", terms: ["关键词"] })).toEqual(["关键词"]);
    expect(resolveBatchTerms({ subject: "主题", resolvedScript: "脚本", terms: [] })).toEqual(["主题"]);
  });

  it("can choose the MoneyPrinterTurbo-style material search basis", () => {
    expect(resolveBatchTerms({ subject: "主题", resolvedScript: "完整脚本", terms: ["关键词"], searchMode: "subject" })).toEqual(["主题"]);
    expect(resolveBatchTerms({ subject: "主题", resolvedScript: "完整脚本", terms: ["关键词"], searchMode: "script" })).toEqual(["完整脚本"]);
    expect(resolveBatchTerms({ subject: "主题", resolvedScript: "完整脚本", terms: ["关键词"], searchMode: "keywords" })).toEqual(["关键词"]);
  });
});
