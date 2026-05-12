const RENDER_START_PROGRESS = 40;
const RENDER_END_PROGRESS = 90;
const BATCH_ITEM_RENDER_START_PROGRESS = 65;
const BATCH_ITEM_RENDER_END_PROGRESS = 95;

export function mapCreatorProgressToJobProgress(progress: number) {
  const clampedCreatorProgress =
    Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0;
  const range = RENDER_END_PROGRESS - RENDER_START_PROGRESS;
  return Math.round(RENDER_START_PROGRESS + (clampedCreatorProgress / 100) * range);
}

export function mapCreatorProgressToBatchItemProgress(progress: number) {
  const clampedCreatorProgress =
    Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0;
  const range = BATCH_ITEM_RENDER_END_PROGRESS - BATCH_ITEM_RENDER_START_PROGRESS;
  return Math.round(BATCH_ITEM_RENDER_START_PROGRESS + (clampedCreatorProgress / 100) * range);
}
