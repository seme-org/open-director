import { describe, expect, it } from "vitest";
import { buildPlanningDocumentV2 } from "./studio-view-model";
import { defaultStudioMessages, toStudioInitialMessages } from "./studio-message-history";
import type { TranslationFn } from "./studio-view-model";

const t: TranslationFn = (key, values) => {
  const labels: Record<string, string> = {
    "planning.untitledStory": "未命名故事",
    "sections.storyOutline": "故事梗概",
    "sections.scenePlaceholder": "场景",
    "sections.waitingSubjects": "等待角色",
    "sections.waitingScenes": "等待场景",
    "sections.waitingStyle": "等待美术风格",
    "sections.artStyle": "美术风格",
    "sections.subject": "角色",
    "sections.storyboard": "分镜剧本",
  };
  let result = labels[key] ?? key;
  for (const [name, value] of Object.entries(values ?? {})) {
    result = result.replace(`{${name}}`, String(value));
  }
  return result;
};

describe("studio message history", () => {
  it("uses the welcome message when a thread has no persisted history", () => {
    expect(toStudioInitialMessages([])).toEqual(defaultStudioMessages);
  });

  it("restores persisted user content and assistant data parts for a refreshed thread", () => {
    const messages = toStudioInitialMessages([
      {
        id: "message-user",
        role: "user",
        content: "我想做小马过河的故事",
        parts: [{ id: "legacy-ui-message", role: "user", parts: [{ type: "text", text: "ignored duplicate" }] }],
      },
      {
        id: "message-assistant",
        role: "assistant",
        content: "策划完成",
        parts: [
          { type: "data-recipe", data: { title: "小马过河的故事", scenes: [] } },
          { type: "text", text: "策划完成" },
        ],
      },
    ]);

    expect(messages).toEqual([
      {
        id: "message-user",
        role: "user",
        content: "我想做小马过河的故事",
        parts: [{ type: "text", text: "我想做小马过河的故事" }],
      },
      {
        id: "message-assistant",
        role: "assistant",
        content: "策划完成",
        parts: [
          { type: "data-recipe", data: { title: "小马过河的故事", scenes: [] } },
          { type: "text", text: "策划完成" },
        ],
      },
    ]);
  });

  it("hydrates completed DB media assets into initial messages for planning cards", () => {
    const messages = toStudioInitialMessages(
      [
        {
          id: "assistant-1",
          role: "assistant",
          parts: [
            {
              type: "data-recipe",
              data: {
                title: "小马过河",
                artStyle: { name: "卡通" },
                characters: [],
                scenes: [
                  { title: "河边", script: "小马来到河边。", visualPrompt: "河边空景" },
                ],
              },
            },
            {
              type: "data-runner-tasks",
              data: {
                tasks: [
                  { id: "scene-1-image", sceneTitle: "河边", tool: "create_location", prompt: "河边空景" },
                ],
              },
            },
          ],
        },
      ],
      [
        {
          id: "asset-1",
          type: "IMAGE",
          title: "河边 - create_location",
          url: "https://cdn.test/river.png",
          metadata: {
            task: { id: "scene-1-image", tool: "create_location", sceneTitle: "河边" },
          },
        },
      ],
    );

    const document = buildPlanningDocumentV2(t, messages);

    expect(document.scenes[0]).toMatchObject({
      name: "河边",
      imageUrl: "https://cdn.test/river.png",
      loading: false,
    });
  });

  it("maps persisted raw SSE event types to data- prefixed types on page refresh", () => {
    const messages = toStudioInitialMessages([
      {
        id: "message-user",
        role: "user",
        content: "草船借箭",
        parts: [],
      },
      {
        id: "message-assistant",
        role: "assistant",
        content: "",
        parts: [
          { type: "recipe", data: { title: "草船借箭", scenes: [], characters: [] } },
          { type: "runner-tasks", data: { tasks: [{ id: "task-1", tool: "create_location" }] } },
          { type: "media-assets", data: { assets: [{ assetId: "a1", url: "https://cdn.test/img.png" }] } },
        ],
      },
    ]);

    const assistant = messages.find((m) => m.id === "message-assistant");
    const partTypes = assistant?.parts.map((p) => p.type);

    expect(partTypes).toContain("data-recipe");
    expect(partTypes).toContain("data-runner-tasks");
    expect(partTypes).toContain("data-media-assets");
    expect(partTypes).not.toContain("recipe");
    expect(partTypes).not.toContain("runner-tasks");
    expect(partTypes).not.toContain("media-assets");
  });

  it("extracts recipe data from persisted parts via latestDataPart after type mapping", () => {
    const messages = toStudioInitialMessages([
      {
        id: "assistant-1",
        role: "assistant",
        content: "",
        parts: [
          { type: "recipe", data: { title: "草船借箭", language: "zh-CN", artStyle: { name: "Ghibli-style" }, scenes: [{ title: "S1", shots: [{ shotId: "s1", dialogue: [{ speaker: "旁白", text: "台词" }] }] }] } },
        ],
      },
    ]);

    const document = buildPlanningDocumentV2(t, messages);

    expect(document.storyOutline.content).toContain("草船借箭");
    expect(document.storyboard.chapters[0].shots[0].fields.dialogue).toContain("台词");
  });
});
