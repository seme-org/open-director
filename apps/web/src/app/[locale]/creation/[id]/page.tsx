import { notFound, redirect } from "next/navigation";
import { prisma } from "@/server/db/prisma";
import { normalizeLocale, withLocale } from "@/i18n.config";
import { getCurrentUser } from "@/server/auth/session";
import { CreationEditor } from "@/components/creation-editor";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function aspectRatioValue(value: unknown) {
  return typeof value === "string" && ["16:9", "9:16", "1:1"].includes(value)
    ? value
    : undefined;
}

export default async function CreationPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const currentLocale = normalizeLocale(locale);
  const user = await getCurrentUser();
  if (!user) redirect(withLocale(currentLocale, "/signin"));
  const [thread, recipe, blocks, assets] = await Promise.all([
    prisma.thread.findFirst({
      where: { id, isDeleted: false },
      select: { id: true, metadata: true },
    }),
    prisma.recipe.findFirst({
      where: { threadId: id },
      orderBy: [{ version: "desc" }, { createdAt: "desc" }],
      select: { content: true },
    }),
    prisma.block.findMany({
      where: { threadId: id },
      orderBy: { order: "asc" },
      select: { id: true, order: true, title: true, script: true, visualPrompt: true, audioPrompt: true, metadata: true },
    }),
    prisma.asset.findMany({
      where: { threadId: id },
      orderBy: { createdAt: "asc" },
      select: { id: true, blockId: true, title: true, type: true, url: true, metadata: true },
    }),
  ]);

  if (!thread) notFound();
  if (!recipe) notFound();
  const threadMetadata = asRecord(thread.metadata);
  const recipeContent = recipe.content as { title?: string; aspectRatio?: string; aspect_ratio?: string; artStyle?: { name?: string; description?: string } };
  const aspectRatio = aspectRatioValue(threadMetadata.aspectRatio) || aspectRatioValue(recipeContent.aspectRatio) || aspectRatioValue(recipeContent.aspect_ratio);

  return (
    <CreationEditor
      locale={currentLocale}
      threadId={id}
      recipe={recipeContent}
      blocks={blocks}
      assets={assets.map((asset) => ({ ...asset, type: asset.type }))}
      aspectRatio={aspectRatio}
    />
  );
}
