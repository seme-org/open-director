import { describe, expect, it } from "vitest";
import {
  batchNotice,
  batchOutputLabel,
  batchStatusLabel,
  createSingleBatchItemPayload,
  singleBatchItemCount,
} from "./batch-workbench-state";

describe("batch workbench state", () => {
  it("explains that a created batch is waiting for the generation pipeline", () => {
    expect(batchStatusLabel("DRAFT_CREATED")).toBe("Draft created");
    expect(batchNotice({ itemCount: 3, outputCount: 3, status: "DRAFT_CREATED" })).toBe(
      "Batch created. 3 items are waiting for the generation pipeline.",
    );
  });

  it("keeps queued status distinct from draft creation", () => {
    expect(batchStatusLabel("QUEUED")).toBe("Queued for generation");
    expect(batchNotice({ itemCount: 2, outputCount: 4, status: "QUEUED" })).toBe(
      "Batch pipeline started. 2 items will produce 4 outputs.",
    );
  });

  it("labels batch outputs with stable numbering and optional titles", () => {
    expect(batchOutputLabel({ title: "First cut" }, 0)).toBe("Output 1 · First cut");
    expect(batchOutputLabel({ title: null }, 1)).toBe("Output 2");
  });

  it("counts a single batch item when subject or script is present", () => {
    expect(singleBatchItemCount({ subject: "宋朝外卖", script: "", terms: [] })).toBe(1);
    expect(singleBatchItemCount({ subject: "", script: "一段完整脚本", terms: [] })).toBe(1);
    expect(singleBatchItemCount({ subject: "", script: "", terms: ["history"] })).toBe(0);
  });

  it("creates one batch payload item with trimmed subject and keywords", () => {
    expect(
      createSingleBatchItemPayload({
        subject: " 宋朝外卖 ",
        script: "第一句。\n第二句。",
        terms: [" Song Dynasty takeout ", "", "ancient food"],
      }),
    ).toEqual([{ subject: "宋朝外卖", script: "第一句。\n第二句。", terms: ["Song Dynasty takeout", "ancient food"] }]);
  });
});
