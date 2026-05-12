import { prisma } from "@/server/db/prisma";

export async function uploadLocalBgm(_prompt: string): Promise<string> {
  const tracks = await prisma.bgm.findMany({
    where: { isPublic: true, isDeleted: false },
    select: { url: true },
  });
  if (!tracks.length) {
    throw new Error("No BGM tracks found in the bgms table.");
  }
  const track = tracks[Math.floor(Math.random() * tracks.length)];
  return track.url;
}
