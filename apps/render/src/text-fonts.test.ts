import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveTextFontPath } from "./text-fonts.js";

describe("resolveTextFontPath", () => {
  const fontsDir = path.resolve(process.cwd(), "..", "..", "assets", "fonts");

  it("resolves the default Chinese font family to a local font file", () => {
    expect(resolveTextFontPath({ fontFamily: "Sarasa UI SC" })).toBe(
      path.join(fontsDir, "SarasaUiSC-Regular.ttf"),
    );
  });

  it("uses a bold local font file when the text style is bold", () => {
    expect(resolveTextFontPath({ fontFamily: "Sarasa UI SC", fontWeight: "bold" })).toBe(
      path.join(fontsDir, "SarasaUiSC-Bold.ttf"),
    );
  });

  it("falls back to a Chinese-capable font for unknown families", () => {
    expect(resolveTextFontPath({ fontFamily: "Missing Font" })).toBe(
      path.join(fontsDir, "SarasaUiSC-Regular.ttf"),
    );
  });

  it("can resolve fonts from an explicit font root", () => {
    expect(
      resolveTextFontPath(
        { fontFamily: "Noto Sans CJK SC", fontWeight: 700 },
        { fontRoots: [fontsDir] },
      ),
    ).toBe(path.join(fontsDir, "NotoSansCJKsc-Bold.otf"));
  });
});
