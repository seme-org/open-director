import { describe, expect, it } from "vitest";
import { studioLayoutClasses } from "./studio-layout";

describe("studio layout classes", () => {
  it("keeps the workspace pinned while each panel owns its scrolling", () => {
    expect(studioLayoutClasses.shell).toContain("h-screen");
    expect(studioLayoutClasses.shell).toContain("overflow-hidden");
    expect(studioLayoutClasses.grid).toContain("h-screen");
    expect(studioLayoutClasses.leftPanel).toContain("h-screen");
    expect(studioLayoutClasses.leftPanel).toContain("min-h-0");
    expect(studioLayoutClasses.messages).toContain("min-h-0");
    expect(studioLayoutClasses.messages).toContain("overflow-y-auto");
    expect(studioLayoutClasses.composer).toContain("shrink-0");
    expect(studioLayoutClasses.rightPanel).toContain("h-screen");
    expect(studioLayoutClasses.rightPanel).toContain("overflow-hidden");
  });
});
