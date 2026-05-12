import { describe, expect, it } from "vitest";
import { determineCanvasSize } from "./asset-processor.js";

describe("determineCanvasSize", () => {
  it("defaults to 720p 16:9 when no items have probed dimensions", () => {
    const size = determineCanvasSize(
      [{} as any, {} as any],
      undefined,
      "task-1",
    );
    expect(size).toEqual({ width: 1280, height: 720 });
  });

  it("uses probed dimensions from the first visual item", () => {
    const size = determineCanvasSize(
      [
        { probedWidth: 1280, probedHeight: 720 } as any,
        { probedWidth: 640, probedHeight: 480 } as any,
      ],
      undefined,
      "task-1",
    );
    expect(size).toEqual({ width: 1280, height: 720 });
  });

  it("defaults to 720p 9:16 when no probed dimensions", () => {
    const size = determineCanvasSize([{} as any], "9:16", "task-1");
    expect(size).toEqual({ width: 720, height: 1280 });
  });

  it("scales down to 480p when resolution is 480", () => {
    const size = determineCanvasSize(
      [{ probedWidth: 1920, probedHeight: 1080 } as any],
      undefined,
      "task-1",
      480,
    );
    expect(size.width).toBeLessThanOrEqual(854);
    expect(size.height).toBeLessThanOrEqual(854);
  });

  it("scales down to 720p by default", () => {
    const size = determineCanvasSize(
      [{ probedWidth: 3840, probedHeight: 2160 } as any],
      undefined,
      "task-1",
    );
    expect(size.width).toBeLessThanOrEqual(1280);
  });

  it("does not upscale when source is smaller than target resolution", () => {
    const size = determineCanvasSize(
      [{ probedWidth: 320, probedHeight: 240 } as any],
      undefined,
      "task-1",
      1080,
    );
    expect(size.width).toBeLessThanOrEqual(320);
    expect(size.height).toBeLessThanOrEqual(240);
  });

  it("ensures dimensions are even numbers", () => {
    const size = determineCanvasSize(
      [{ probedWidth: 1921, probedHeight: 1081 } as any],
      undefined,
      "task-1",
    );
    expect(size.width % 2).toBe(0);
    expect(size.height % 2).toBe(0);
  });
});
