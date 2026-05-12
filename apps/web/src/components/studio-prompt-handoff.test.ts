import { describe, expect, it, vi } from "vitest";
import { pendingPromptKey, storePendingPrompt, takePendingPrompt } from "./studio-prompt-handoff";

describe("studio prompt handoff", () => {
  it("uses a stable per-thread session storage key", () => {
    expect(pendingPromptKey("thread-1")).toBe("open-director-pending-prompt:thread-1");
  });

  it("stores the prompt before navigation and consumes it once on the thread page", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        values.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        values.delete(key);
      }),
    };

    storePendingPrompt(storage, "thread-1", "我想做小马过河");

    expect(storage.setItem).toHaveBeenCalledWith("open-director-pending-prompt:thread-1", "我想做小马过河");
    expect(takePendingPrompt(storage, "thread-1")).toBe("我想做小马过河");
    expect(storage.removeItem).toHaveBeenCalledWith("open-director-pending-prompt:thread-1");
    expect(takePendingPrompt(storage, "thread-1")).toBeNull();
  });
});
