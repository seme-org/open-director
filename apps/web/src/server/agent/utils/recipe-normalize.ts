import { filterReusableVisualSubjects } from "@/lib/planning-subjects";
import {
  loadPublicArtStyles,
  resolveArtStyleFromCatalog,
  type PublicArtStyle,
} from "@/server/agent/art-styles";
import {
  loadAvailableVoices,
  resolveVoiceById,
  resolveVoiceForGender,
  type PublicVoice,
} from "@/server/agent/voices";
import type { DirectorRecipe } from "@/server/agent/schemas/recipe";

export function resolveFixedArtStyle(
  name: string | null | undefined,
  catalog: PublicArtStyle[],
) {
  const style = resolveArtStyleFromCatalog(catalog, name);
  return {
    name: style.name,
    promptPrefix: style.promptPrefix,
    description: style.description,
    keywords: style.keywords,
    imageUrl: style.imageUrl,
    reasoning: null,
    detail: style.description,
    imagePrompt: style.promptPrefix,
  };
}

function isValidHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function normalizeRecipe(
  recipe: DirectorRecipe,
  artStyleCatalog: PublicArtStyle[],
  voiceCatalog: PublicVoice[] = [],
): DirectorRecipe {
  const fixedArtStyle = resolveFixedArtStyle(
    recipe.artStyle.name,
    artStyleCatalog,
  );
  const artStyle = {
    ...recipe.artStyle,
    name: fixedArtStyle.name,
    promptPrefix: fixedArtStyle.promptPrefix,
    description: fixedArtStyle.description,
    keywords: fixedArtStyle.keywords,
    imageUrl: isValidHttpUrl(recipe.artStyle.imageUrl) ? recipe.artStyle.imageUrl : fixedArtStyle.imageUrl,
    detail: fixedArtStyle.description,
    imagePrompt: fixedArtStyle.promptPrefix,
  };
  const bgm = {
    ...recipe.bgm,
    style: recipe.bgm.style || recipe.bgm.createMusicParams.tags.join(", "),
    prompt: recipe.bgm.prompt || recipe.bgm.createMusicParams.tags.join(", "),
  };
  const characters = filterReusableVisualSubjects(recipe.characters).map((character) => {
    const matchedVoice =
      resolveVoiceById(voiceCatalog, character.voiceId) ||
      resolveVoiceForGender(voiceCatalog, character.gender);
    return {
      ...character,
      voiceId: matchedVoice.voiceId,
      voice: character.voice || matchedVoice.detail || matchedVoice.name,
      voiceSampleUrl: matchedVoice.voiceSampleUrl || undefined,
    };
  });

  // Pick a narrator voice that's different from all character voices
  const usedVoiceIds = new Set(characters.map((c) => c.voiceId).filter(Boolean));
  const narratorVoice = voiceCatalog.find((v) => !usedVoiceIds.has(v.voiceId));

  const result: DirectorRecipe & { narratorVoiceId?: string } = {
    ...recipe,
    artStyle,
    characters,
    bgm,
    mediaPlan: recipe.media.shots.map((shot) => ({
      sceneTitle: shot.sceneTitle,
      assetType: "video" as const,
      prompt: shot.imageToVideoPromptText,
    })),
  };
  if (narratorVoice) {
    result.narratorVoiceId = narratorVoice.voiceId;
  }
  return result;
}

export function recipeComponentsData(recipe: DirectorRecipe) {
  return {
    title: recipe.title,
    intent: recipe.intent,
    audience: recipe.audience,
    tone: recipe.tone,
    language: recipe.language,
    artStyle: recipe.artStyle,
    characters: recipe.characters,
    locations: recipe.locations,
    scenes: recipe.scenes,
    bgm: recipe.bgm,
    media: recipe.media,
  };
}

export function recipeSectionData(
  recipe: DirectorRecipe,
  section: "outline" | "style" | "subjects" | "scenes" | "complete",
) {
  const base = {
    title: recipe.title,
    summary: recipe.summary,
    highlights: recipe.highlights,
    intent: recipe.intent,
    audience: recipe.audience,
    tone: recipe.tone,
    language: recipe.language,
  };
  if (section === "outline") return base;
  if (section === "style") return { ...base, artStyle: recipe.artStyle };
  if (section === "subjects")
    return {
      ...base,
      artStyle: recipe.artStyle,
      characters: recipe.characters,
      locations: recipe.locations,
    };
  if (section === "scenes")
    return {
      ...base,
      artStyle: recipe.artStyle,
      characters: recipe.characters,
      locations: recipe.locations,
      scenes: recipe.scenes,
    };
  return recipeComponentsData(recipe);
}
