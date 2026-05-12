import { describe, expect, it } from "vitest";
import { parseBatchItems, parseBatchLines } from "./input";

describe("parseBatchLines", () => {
  it("parses non-empty lines as subjects", () => {
    expect(parseBatchLines("唐朝人真的以胖为美吗\n\n宋朝人为什么爱点外卖")).toEqual([
      { order: 1, subject: "唐朝人真的以胖为美吗", script: "", terms: [] },
      { order: 2, subject: "宋朝人为什么爱点外卖", script: "", terms: [] },
    ]);
  });

  it("parses pipe-delimited subject, script, and terms", () => {
    expect(parseBatchLines("标题 | 这是完整脚本 | 历史, 唐朝")).toEqual([
      { order: 1, subject: "标题", script: "这是完整脚本", terms: ["历史", "唐朝"] },
    ]);
  });

  it("rejects rows where subject and script are both empty", () => {
    expect(() => parseBatchLines(" | | 关键词")).toThrow("Line 1 must include a subject or script.");
  });
});

describe("parseBatchItems", () => {
  it("parses one explicit batch item without splitting multiline scripts", () => {
    expect(
      parseBatchItems([
        {
          subject: "宋朝外卖",
          script: "第一句脚本。\n第二句脚本。",
          terms: ["Song Dynasty takeout", "ancient Chinese food"],
        },
      ]),
    ).toEqual([
      {
        order: 1,
        subject: "宋朝外卖",
        script: "第一句脚本。\n第二句脚本。",
        terms: ["Song Dynasty takeout", "ancient Chinese food"],
      },
    ]);
  });

  it("rejects explicit items without a subject or script", () => {
    expect(() => parseBatchItems([{ subject: " ", script: "", terms: ["keyword"] }])).toThrow(
      "Item 1 must include a subject or script.",
    );
  });
});
