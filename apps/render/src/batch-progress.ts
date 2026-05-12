import type { Prisma } from "@prisma/client";

type BatchProgressClient = {
  batchItem: {
    updateMany: (args: {
      where: { id: string };
      data: Prisma.BatchItemUpdateManyMutationInput;
    }) => Promise<{ count: number }>;
  };
};

export async function updateBatchItemIfExists(
  prisma: BatchProgressClient,
  batchItemId: string,
  data: Prisma.BatchItemUpdateManyMutationInput,
) {
  const result = await prisma.batchItem.updateMany({
    where: { id: batchItemId },
    data,
  });
  return result.count > 0;
}
