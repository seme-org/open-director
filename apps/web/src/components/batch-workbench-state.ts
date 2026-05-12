export type BatchSummaryForNotice = {
  itemCount: number;
  outputCount: number;
  status: string;
  statusDetail?: string | null;
};

export type SingleBatchDraftItem = {
  subject: string;
  script: string;
  terms: string[];
};

function trimTerms(terms: string[]) {
  return terms.map((term) => term.trim()).filter(Boolean);
}

export function singleBatchItemCount(item: SingleBatchDraftItem) {
  return item.subject.trim() || item.script.trim() ? 1 : 0;
}

export function createSingleBatchItemPayload(item: SingleBatchDraftItem) {
  if (!singleBatchItemCount(item)) return [];

  return [
    {
      subject: item.subject.trim(),
      script: item.script.trim(),
      terms: trimTerms(item.terms),
    },
  ];
}

export function batchStatusLabel(status: string) {
  if (status === "DRAFT_CREATED") return "Draft created";
  if (status === "QUEUED") return "Queued for generation";
  if (status === "ACTIVE") return "Generating";
  if (status === "COMPLETED") return "Completed";
  if (status === "FAILED") return "Failed";
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function batchNotice(batch: BatchSummaryForNotice) {
  if (batch.statusDetail) return batch.statusDetail;
  if (batch.status === "DRAFT_CREATED") {
    return `Batch created. ${batch.itemCount} items are waiting for the generation pipeline.`;
  }
  if (batch.status === "QUEUED") {
    return `Batch pipeline started. ${batch.itemCount} items will produce ${batch.outputCount} outputs.`;
  }
  if (batch.status === "ACTIVE") {
    return `Batch is generating ${batch.outputCount} outputs.`;
  }
  if (batch.status === "COMPLETED") {
    return `Batch completed with ${batch.outputCount} planned outputs.`;
  }
  if (batch.status === "FAILED") {
    return "Batch failed. Check each item for details.";
  }
  return `${batchStatusLabel(batch.status)}. ${batch.itemCount} items, ${batch.outputCount} planned outputs.`;
}

export function batchItemStatusDetail(status: string) {
  if (status === "DRAFT_CREATED") return "Waiting for script, TTS, material selection, and render pipeline.";
  if (status === "QUEUED") return "Queued for render worker.";
  if (status === "ACTIVE") return "Generation pipeline is running.";
  if (status === "COMPLETED") return "Outputs are ready.";
  if (status === "FAILED") return "Generation failed for this item.";
  return "Waiting for the next pipeline step.";
}

export function batchOutputLabel(output: { title?: string | null }, index: number) {
  const base = `Output ${index + 1}`;
  return output.title ? `${base} · ${output.title}` : base;
}
