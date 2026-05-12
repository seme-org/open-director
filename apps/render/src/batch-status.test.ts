import { describe, expect, it } from "vitest";
import { resolveFinishedBatchStatus } from "./batch-status.js";

describe("resolveFinishedBatchStatus", () => {
  it("marks a batch completed when all items completed", () => {
    expect(resolveFinishedBatchStatus([{ status: "COMPLETED" }, { status: "COMPLETED" }])).toBe("COMPLETED");
  });

  it("marks a batch failed when all items finished and at least one failed", () => {
    expect(resolveFinishedBatchStatus([{ status: "COMPLETED" }, { status: "FAILED" }])).toBe("FAILED");
  });

  it("does not finish while any item is still active or queued", () => {
    expect(resolveFinishedBatchStatus([{ status: "COMPLETED" }, { status: "ACTIVE" }])).toBeUndefined();
    expect(resolveFinishedBatchStatus([{ status: "COMPLETED" }, { status: "QUEUED" }])).toBeUndefined();
  });
});
