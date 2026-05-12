import { describe, expect, it, vi } from "vitest";
import { loadAvailableVoices, resolveVoiceForGender } from "./voices";

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    voices: {
      findMany: vi.fn(),
    },
  },
}));

describe("database voice catalog", () => {
  it("loads public and current-user voices from the voices table", async () => {
    const { prisma } = await import("@/server/db/prisma");
    const prismaMock = prisma as unknown as { voices: { findMany: ReturnType<typeof vi.fn> } };
    prismaMock.voices.findMany.mockResolvedValueOnce([
      {
        voiceId: "Calm_Woman",
        name: "Calm Woman",
        gender: "female",
        detail: "Warm narration",
        voiceSample: "https://cdn.test/calm.mp3",
        isPublic: true,
        userId: null,
      },
    ] as never);

    await expect(loadAvailableVoices("user-1")).resolves.toEqual([
      expect.objectContaining({
        voiceId: "Calm_Woman",
        name: "Calm Woman",
        gender: "female",
        voiceSampleUrl: "https://cdn.test/calm.mp3",
      }),
    ]);
    expect(prismaMock.voices.findMany).toHaveBeenCalledWith({
      where: { OR: [{ isPublic: true }, { userId: "user-1" }] },
      orderBy: [{ isPublic: "desc" }, { createdAt: "desc" }, { voiceId: "asc" }],
      select: {
        voiceId: true,
        name: true,
        gender: true,
        detail: true,
        voiceSample: true,
        isPublic: true,
        userId: true,
      },
    });
  });

  it("chooses a matching voice by gender from the catalog", () => {
    expect(
      resolveVoiceForGender(
        [
          { voiceId: "Calm_Woman", name: "Calm Woman", gender: "female", detail: "", voiceSampleUrl: "", isPublic: true, userId: null },
          { voiceId: "Elegant_Man", name: "Elegant Man", gender: "male", detail: "", voiceSampleUrl: "", isPublic: true, userId: null },
        ],
        "male",
      ).voiceId,
    ).toBe("Elegant_Man");
  });
});
