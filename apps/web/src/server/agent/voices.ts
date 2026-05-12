import { prisma } from "@/server/db/prisma";

export const DEFAULT_TTS_VOICE_ID = "Calm_Woman";

export type PublicVoice = {
  voiceId: string;
  name: string;
  gender: "male" | "female" | "unknown";
  detail: string;
  voiceSampleUrl: string;
  isPublic: boolean;
  userId: string | null;
};

type DbVoice = {
  voiceId: string;
  name: string;
  gender: string;
  detail: string | null;
  voiceSample: string | null;
  isPublic: boolean;
  userId: string | null;
};

type VoicesDelegate = {
  findMany: (args: {
    where: { isPublic: boolean } | { OR: Array<{ isPublic: boolean } | { userId: string }> };
    orderBy: Array<Record<string, "asc" | "desc">>;
    select: Record<string, boolean>;
  }) => Promise<DbVoice[]>;
};

export function normalizeVoiceGender(value: unknown): PublicVoice["gender"] {
  const text = String(value || "").trim().toLowerCase();
  if (["male", "man", "boy", "m", "男", "男性"].includes(text)) return "male";
  if (["female", "woman", "girl", "f", "女", "女性"].includes(text)) return "female";
  return "unknown";
}

function toPublicVoice(voice: DbVoice): PublicVoice {
  return {
    voiceId: voice.voiceId,
    name: voice.name,
    gender: normalizeVoiceGender(voice.gender),
    detail: voice.detail || "",
    voiceSampleUrl: voice.voiceSample || "",
    isPublic: voice.isPublic,
    userId: voice.userId,
  };
}

export async function loadAvailableVoices(userId?: string | null): Promise<PublicVoice[]> {
  const where = userId
    ? { OR: [{ isPublic: true }, { userId }] }
    : { isPublic: true };
  const voicesClient = prisma as unknown as { voices: VoicesDelegate };
  const voices = await voicesClient.voices.findMany({
    where,
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
  return voices.map(toPublicVoice);
}

export function resolveVoiceById(catalog: PublicVoice[], voiceId: string | null | undefined) {
  const normalized = (voiceId || "").trim();
  if (!normalized) return undefined;
  return catalog.find((voice) => voice.voiceId === normalized);
}

let voiceRotationIndex = 0;

export function resolveVoiceForGender(catalog: PublicVoice[], gender: unknown) {
  const normalizedGender = normalizeVoiceGender(gender);
  const candidates = normalizedGender !== "unknown"
    ? catalog.filter((voice) => voice.gender === normalizedGender)
    : catalog;
  if (candidates.length > 0) {
    const voice = candidates[voiceRotationIndex % candidates.length];
    voiceRotationIndex++;
    return voice;
  }
  return (
    catalog.find((voice) => voice.voiceId === DEFAULT_TTS_VOICE_ID) ||
    catalog.find((voice) => voice.gender === "female") ||
    catalog[0] || {
      voiceId: DEFAULT_TTS_VOICE_ID,
      name: DEFAULT_TTS_VOICE_ID,
      gender: "female",
      detail: "Default narration voice",
      voiceSampleUrl: "",
      isPublic: true,
      userId: null,
    }
  );
}

export function voicePromptLines(catalog: PublicVoice[]) {
  return catalog
    .map((voice) => {
      const scope = voice.isPublic ? "public voice" : "private voice";
      const detail = voice.detail ? `, detail=${voice.detail}` : "";
      return `- ${scope}: voice_id=${voice.voiceId}, name=${voice.name}, gender=${voice.gender}${detail}`;
    })
    .join("\n");
}
