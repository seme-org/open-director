import fs from "node:fs";
import path from "node:path";

type TextStyle = {
  fontFamily?: string;
  fontWeight?: string | number;
};

type ResolveTextFontPathOptions = {
  fontRoots?: string[];
};

const FONT_FILES = {
  notoSans: {
    regular: "NotoSans-Regular.ttf",
    bold: "NotoSans-Bold.ttf",
  },
  notoSansCjkSc: {
    regular: "NotoSansCJKsc-Regular.otf",
    bold: "NotoSansCJKsc-Bold.otf",
  },
  sarasaUiSc: {
    regular: "SarasaUiSC-Regular.ttf",
    bold: "SarasaUiSC-Bold.ttf",
  },
} as const;

function defaultFontRoots() {
  return [
    process.env.OPEN_DIRECTOR_FONT_DIR,
    path.resolve(process.cwd(), "assets", "fonts"),
    path.resolve(process.cwd(), "..", "..", "assets", "fonts"),
    "/usr/share/fonts/open-director",
  ].filter(Boolean) as string[];
}

function isBold(fontWeight: TextStyle["fontWeight"]) {
  if (typeof fontWeight === "number") return fontWeight >= 600;
  return /bold|[6-9]00/.test(String(fontWeight ?? "").toLowerCase());
}

function pickFontFiles(fontFamily: string | undefined) {
  const family = String(fontFamily ?? "").toLowerCase();
  if (family.includes("sarasa")) return FONT_FILES.sarasaUiSc;
  if (family.includes("cjk") || family.includes("noto sans sc")) {
    return FONT_FILES.notoSansCjkSc;
  }
  if (family.includes("noto sans") && family !== "noto sans") return FONT_FILES.notoSans;
  return FONT_FILES.sarasaUiSc;
}

function findFontPath(fileName: string, fontRoots: string[]) {
  for (const root of fontRoots) {
    const fontPath = path.join(root, fileName);
    if (fs.existsSync(fontPath)) return fontPath;
  }
  return path.join(fontRoots[0] ?? path.resolve(process.cwd(), "assets", "fonts"), fileName);
}

export function resolveTextFontPath(
  style: TextStyle,
  options: ResolveTextFontPathOptions = {},
) {
  const fontRoots = options.fontRoots ?? defaultFontRoots();
  const fontFiles = pickFontFiles(style.fontFamily);
  return findFontPath(isBold(style.fontWeight) ? fontFiles.bold : fontFiles.regular, fontRoots);
}
