import type { SSEMessage } from "@/components/types/sse-message";

export const defaultStudioMessages: SSEMessage[] = [
  {
    id: "studio-welcome",
    role: "assistant",
    content: "",
    parts: [
      {
        type: "text",
        text: "Bring me a rough idea. I will turn it into scenes, assets, and a render plan.",
      },
    ],
  },
];

type PersistedMessage = {
  id: string;
  role: string;
  content?: string | null;
  parts?: unknown;
};

type PersistedAsset = {
  id: string;
  title: string;
  type: string;
  url: string | null;
  metadata?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function isPart(value: unknown): value is SSEMessage["parts"][number] {
  return Boolean(value && typeof value === "object" && "type" in value);
}

function normalizeRole(role: string): SSEMessage["role"] {
  return role === "user" ? "user" : "assistant";
}

const PERSISTED_PART_TYPE_MAP: Record<string, string> = {
  "agent-status": "data-agent-status",
  "director-brief": "data-director-brief",
  "recipe": "data-recipe",
  "recipe-components": "data-recipe-components",
  "runner-tasks": "data-runner-tasks",
  "runner-progress": "data-runner-progress",
  "media-assets": "data-media-assets",
};

function partsFromPersisted(message: PersistedMessage): SSEMessage["parts"] {
  if (message.role === "user" && message.content?.trim()) {
    return [{ type: "text", text: message.content.trim() }];
  }

  if (Array.isArray(message.parts)) {
    const parts = message.parts
      .filter(isPart)
      .map((part): SSEMessage["parts"][number] => {
        const mappedType = PERSISTED_PART_TYPE_MAP[part.type] ?? part.type;
        return { ...part, type: mappedType } as SSEMessage["parts"][number];
      });
    if (parts.length) return parts;
  }

  if (message.content?.trim()) {
    return [{ type: "text", text: message.content.trim() }];
  }

  return [];
}

function mediaAssetsPartFromPersisted(assets: PersistedAsset[]) {
  const mediaAssets = assets
    .filter((asset) => asset.url)
    .map((asset) => {
      const metadata = asRecord(asset.metadata);
      const task = asRecord(metadata.task);
      return {
        assetId: asset.id,
        type: asset.type,
        url: asset.url,
        title: asset.title,
        tool: textValue(task.tool),
        taskId: textValue(task.id),
        shotId: textValue(task.shotId),
        sceneTitle: textValue(task.sceneTitle),
        metadata: asset.metadata,
      };
    });

  if (!mediaAssets.length) return undefined;
  return {
    id: "persisted-media-assets",
    role: "assistant" as const,
    content: "",
    parts: [
      {
        type: "data-media-assets",
        data: { assets: mediaAssets },
      },
    ] as SSEMessage["parts"],
  };
}

export function toStudioInitialMessages(
  messages: PersistedMessage[],
  assets: PersistedAsset[] = [],
): SSEMessage[] {
  const restored = messages
    .map((message) => ({
      id: message.id,
      role: normalizeRole(message.role),
      content: message.content ?? "",
      parts: partsFromPersisted(message),
    }))
    .filter((message) => message.parts.length > 0);

  const base = restored.length ? restored : defaultStudioMessages;
  const mediaAssetsMessage = mediaAssetsPartFromPersisted(assets);
  return mediaAssetsMessage ? [...base, mediaAssetsMessage] : base;
}
