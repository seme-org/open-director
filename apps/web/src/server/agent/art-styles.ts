import { prisma } from "@/server/db/prisma";

export type PublicArtStyle = {
  id: string;
  name: string;
  category: string;
  promptPrefix: string;
  description: string;
  keywords: string[];
  imageUrl: string | null;
};

type DbArtStyle = {
  id: string;
  name: string;
  category: string;
  promptPrefix: string;
  description: string | null;
  keywords: unknown;
  imageUrl: string | null;
};

function normalizeKeywords(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((keyword): keyword is string => typeof keyword === "string" && keyword.trim().length > 0);
}

function toPublicArtStyle(style: DbArtStyle): PublicArtStyle {
  return {
    id: style.id,
    name: style.name,
    category: style.category,
    promptPrefix: style.promptPrefix,
    description: style.description || "",
    keywords: normalizeKeywords(style.keywords),
    imageUrl: style.imageUrl,
  };
}

export async function loadPublicArtStyles(): Promise<PublicArtStyle[]> {
  const styles = await prisma.artStyle.findMany({
    where: { isPublic: true, isDeleted: false },
    orderBy: [{ category: "asc" }, { name: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      category: true,
      imageUrl: true,
      description: true,
      promptPrefix: true,
      keywords: true,
    },
  });
  return styles.map(toPublicArtStyle);
}

export function resolveArtStyleFromCatalog(catalog: PublicArtStyle[], name: string | null | undefined) {
  if (!catalog.length) {
    throw new Error("No public art styles are configured in the art_styles table.");
  }

  const normalized = (name || "").trim().toLowerCase();
  const exact = catalog.find((style) => style.name.toLowerCase() === normalized);
  if (exact) return exact;

  return catalog.find((style) => style.name !== "Ghibli-style") || catalog[0];
}

export function artStylePromptLines(catalog: PublicArtStyle[]) {
  return catalog
    .map((style) => `- ${style.name}: ${style.description}; promptPrefix: ${style.promptPrefix}; keywords: ${style.keywords.join(", ")}`)
    .join("\n");
}
