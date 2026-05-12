import { describe, expect, it } from "vitest";
import {
  mapCreatorProgressToBatchItemProgress,
  mapCreatorProgressToJobProgress,
} from "./render-progress.js";

describe("mapCreatorProgressToJobProgress", () => {
  it("maps ffcreator render progress into the active job progress range", () => {
    expect(mapCreatorProgressToJobProgress(0)).toBe(40);
    expect(mapCreatorProgressToJobProgress(25)).toBe(53);
    expect(mapCreatorProgressToJobProgress(50)).toBe(65);
    expect(mapCreatorProgressToJobProgress(100)).toBe(90);
  });

  it("clamps invalid progress values", () => {
    expect(mapCreatorProgressToJobProgress(-20)).toBe(40);
    expect(mapCreatorProgressToJobProgress(200)).toBe(90);
    expect(mapCreatorProgressToJobProgress(Number.NaN)).toBe(40);
  });

  it("maps ffcreator render progress into the batch item progress range", () => {
    expect(mapCreatorProgressToBatchItemProgress(0)).toBe(65);
    expect(mapCreatorProgressToBatchItemProgress(25)).toBe(73);
    expect(mapCreatorProgressToBatchItemProgress(50)).toBe(80);
    expect(mapCreatorProgressToBatchItemProgress(100)).toBe(95);
  });
});
