import { describe, expect, it } from "vitest";
import { importBatchText } from "./batch-workbench-import";

describe("importBatchText", () => {
  it("keeps txt input as trimmed lines", () => {
    expect(importBatchText("topics.txt", "  第一条  \n\n第二条\n")).toBe("第一条\n第二条");
  });

  it("converts simple csv rows into batch lines", () => {
    expect(importBatchText("topics.csv", '标题,完整脚本,历史,唐朝\n第二条,,关键词A,关键词B')).toBe(
      "标题 | 完整脚本 | 历史, 唐朝\n第二条 |  | 关键词A, 关键词B",
    );
  });

  it("handles quoted csv cells", () => {
    expect(importBatchText("topics.csv", '"标题,一", "脚本,二", "关键词,三"')).toBe("标题,一 | 脚本,二 | 关键词,三");
  });
});
