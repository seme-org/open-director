import { describe, expect, it } from "vitest";
import { homePromptThreadBody, homePromptThreadPath } from "./home-prompt-handoff";

describe("home prompt handoff", () => {
  it("creates the thread payload from the submitted homepage prompt", () => {
    expect(homePromptThreadBody("  我想做小马过河的故事  ")).toEqual({
      title: "我想做小马过河的故事",
      description: "我想做小马过河的故事",
    });
  });

  it("builds the localized chat thread path after thread creation", () => {
    expect(homePromptThreadPath("zh-CN", "thread-1")).toBe("/zh-CN/chat/thread-1");
    expect(homePromptThreadPath("en", "thread-1")).toBe("/chat/thread-1");
  });
});
