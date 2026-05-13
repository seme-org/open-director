import { describe, expect, it, vi } from "vitest";
import { SSEWriter } from "./sse-writer";

describe("SSEWriter", () => {
  it("does not throw when the stream controller is already closed", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const controller = {
      enqueue: vi.fn(() => {
        throw new TypeError("Invalid state: Controller is already closed");
      }),
      close: vi.fn(),
    } as unknown as ReadableStreamDefaultController;
    const writer = new SSEWriter(controller, { requestId: "req-test" });

    expect(() => writer.write("recipe", { ok: true })).not.toThrow();
    expect(writer.isClosed()).toBe(true);

    await expect(writer.close()).resolves.toBeUndefined();
    expect(controller.close).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      "[sse:req-test] write failed; marking stream closed",
      expect.objectContaining({
        event: "recipe",
        error: "Invalid state: Controller is already closed",
      }),
    );
  });
});
