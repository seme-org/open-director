import { describe, expect, it, vi } from "vitest";
import { loadPublicArtStyles, resolveArtStyleFromCatalog } from "./art-styles";

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    artStyle: {
      findMany: vi.fn(),
    },
  },
}));

describe("database art style catalog", () => {
  it("loads only public non-deleted art styles from the database", async () => {
    const { prisma } = await import("@/server/db/prisma");
    vi.mocked(prisma.artStyle.findMany).mockResolvedValueOnce([
      {
        id: "as_0020",
        name: "Ghibli-style",
        category: "2D Animation",
        imageUrl: "/images/adv-style-images/ghibli-2d.png",
        description: "Warm, Cozy, Hand-drawn 2D",
        promptPrefix: "Studio Ghibli style 2D",
        keywords: ["ghibli", "2d"],
      },
    ] as never);

    await expect(loadPublicArtStyles()).resolves.toEqual([
      expect.objectContaining({
        id: "as_0020",
        name: "Ghibli-style",
        promptPrefix: "Studio Ghibli style 2D",
        keywords: ["ghibli", "2d"],
      }),
    ]);
    expect(prisma.artStyle.findMany).toHaveBeenCalledWith({
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
  });

  it("resolves unknown names to a neutral public fallback instead of biasing toward Ghibli-style", () => {
    expect(resolveArtStyleFromCatalog([
      {
        id: "as_0020",
        name: "Ghibli-style",
        category: "2D Animation",
        imageUrl: "/images/adv-style-images/ghibli-2d.png",
        description: "Warm, Cozy, Hand-drawn 2D",
        promptPrefix: "Studio Ghibli style 2D",
        keywords: ["ghibli", "2d"],
      },
      {
        id: "as_0001",
        name: "Cinematic Photoreal",
        category: "Live-action / Photoreal",
        imageUrl: "/images/adv-style-images/cinematic-photoreal.png",
        description: "Film-like, Photoreal, Dramatic",
        promptPrefix: "cinematic live-action",
        keywords: ["cinematic"],
      },
    ], "unknown")).toMatchObject({
      id: "as_0001",
      name: "Cinematic Photoreal",
    });
  });
});
