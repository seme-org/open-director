import { describe, expect, it } from "vitest";
import { buildBatchScriptPrompt, buildBatchTermsPrompt, parseGeneratedTerms } from "./draft";

describe("batch draft helpers", () => {
  it("parses generated keyword text into clean search terms", () => {
    expect(parseGeneratedTerms("1. Song Dynasty takeout\n2. ancient Chinese food delivery\nChinese takeaway culture")).toEqual([
      "Song Dynasty takeout",
      "ancient Chinese food delivery",
      "Chinese takeaway culture",
    ]);
  });

  it("builds a script prompt from subject and language", () => {
    expect(buildBatchScriptPrompt({ subject: "宋朝人为什么喜欢点外卖", language: "zh-CN", paragraphCount: 1 })).toContain(
      "宋朝人为什么喜欢点外卖",
    );
    expect(buildBatchScriptPrompt({ subject: "宋朝人为什么喜欢点外卖", language: "zh-CN", paragraphCount: 1 })).toContain("zh-CN");
  });

  it("builds a keyword prompt from the editable script", () => {
    const prompt = buildBatchTermsPrompt({ subject: "宋朝外卖", script: "宋朝时期，夜市和饮食业兴盛。", amount: 5, language: "zh-CN" });
    expect(prompt).toContain("宋朝时期，夜市和饮食业兴盛。");
    expect(prompt).toContain("5");
    expect(prompt).toContain("zh-CN");
  });
});
