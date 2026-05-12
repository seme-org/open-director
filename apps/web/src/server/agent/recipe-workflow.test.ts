import { describe, expect, it } from "vitest";
import {
  getRecipeWorkflowComponents,
  getRecipeWorkflowPreviewComponents,
  planRecipeWorkflowBatches,
  recipeWorkflowPreviewComponents,
} from "./recipe-workflow";

describe("recipe workflow patterns", () => {
  it("plans the story recipe workflow in dependency batches", () => {
    expect(planRecipeWorkflowBatches()).toEqual([
      ["language"],
      ["script"],
      ["art_style", "storyboard"],
      ["character", "bgm"],
      ["voice", "media"],
    ]);
  });

  it("keeps story frontend preview components in workflow order", () => {
    expect(
      getRecipeWorkflowPreviewComponents().map((component) => ({
        name: component.name,
        order: component.order,
        status: component.status,
      })),
    ).toEqual([
      { name: "language", order: 1, status: "pending" },
      { name: "script", order: 2, status: "pending" },
      { name: "art_style", order: 3, status: "pending" },
      { name: "storyboard", order: 4, status: "pending" },
      { name: "character", order: 5, status: "pending" },
      { name: "voice", order: 6, status: "pending" },
      { name: "bgm", order: 7, status: "pending" },
      { name: "media", order: 8, status: "pending" },
    ]);
  });

  it("exposes only the story workflow preview component list", () => {
    expect(recipeWorkflowPreviewComponents).toEqual(
      getRecipeWorkflowPreviewComponents(),
    );
  });

  it("exposes chat-agent compatible dependencies for recipe components", () => {
    expect(getRecipeWorkflowComponents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "character",
          dependsOn: ["script", "art_style", "storyboard"],
          agentName: "character_agent",
        }),
        expect.objectContaining({
          name: "media",
          dependsOn: ["storyboard", "character"],
          agentName: "media_agent",
        }),
      ]),
    );
  });
});
