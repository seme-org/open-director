import { describe, expect, it, vi } from "vitest";
import { updateBatchItemIfExists } from "./batch-progress.js";

describe("updateBatchItemIfExists", () => {
  it("does not throw when a queued render job points to a deleted batch item", async () => {
    const prisma = {
      batchItem: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const result = await updateBatchItemIfExists(prisma, "missing-item", {
      status: "ACTIVE",
      progress: 65,
    });

    expect(result).toBe(false);
    expect(prisma.batchItem.updateMany).toHaveBeenCalledWith({
      where: { id: "missing-item" },
      data: { status: "ACTIVE", progress: 65 },
    });
  });

  it("returns true when the batch item was updated", async () => {
    const prisma = {
      batchItem: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    await expect(
      updateBatchItemIfExists(prisma, "existing-item", { progress: 80 }),
    ).resolves.toBe(true);
  });
});
