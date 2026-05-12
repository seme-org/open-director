type BatchItemStatus = {
  status: string;
};

type PrismaLike = {
  batchItem: {
    findUnique(args: {
      where: { id: string };
      select: { batchId: true };
    }): Promise<{ batchId: string } | null>;
    findMany(args: {
      where: { batchId: string };
      select: { status: true };
    }): Promise<BatchItemStatus[]>;
  };
  batch: {
    update(args: {
      where: { id: string };
      data: { status: "COMPLETED" | "FAILED"; finishedAt: Date };
    }): Promise<unknown>;
  };
};

export function resolveFinishedBatchStatus(items: BatchItemStatus[]) {
  if (!items.length) return undefined;
  if (items.some((item) => item.status !== "COMPLETED" && item.status !== "FAILED")) return undefined;
  if (items.some((item) => item.status === "FAILED")) return "FAILED" as const;
  return "COMPLETED" as const;
}

export async function updateParentBatchIfFinished(prisma: PrismaLike, batchItemId: string) {
  const batchItem = await prisma.batchItem.findUnique({
    where: { id: batchItemId },
    select: { batchId: true },
  });
  if (!batchItem) return undefined;

  const items = await prisma.batchItem.findMany({
    where: { batchId: batchItem.batchId },
    select: { status: true },
  });

  const status = resolveFinishedBatchStatus(items);
  if (!status) return undefined;

  await prisma.batch.update({
    where: { id: batchItem.batchId },
    data: { status, finishedAt: new Date() },
  });
  return status;
}
