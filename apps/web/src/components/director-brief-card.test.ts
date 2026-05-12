import { describe, expect, it } from "vitest";
import { buildModifiedDirectorBrief } from "./director-brief-card";

describe("director brief card", () => {
  it("builds a modified brief from editable input, fill, and choice values", () => {
    const brief = {
      name: "director_brief",
      title: "Director Brief",
      project_name: "小马过河",
      exam: {
        input_parameter: [
          { key: "aspect_ratio", label: "Aspect ratio", value: "16:9" },
        ],
        fill_blank: [{ key: "audience", label: "Audience", value: "" }],
        single_choice: [],
        multi_choice: [],
      },
    };

    expect(
      buildModifiedDirectorBrief(
        brief,
        { aspect_ratio: "9:16" },
        { audience: "儿童" },
        {},
      ),
    ).toMatchObject({
      exam: {
        input_parameter: [
          { key: "aspect_ratio", label: "Aspect ratio", value: "9:16" },
        ],
        fill_blank: [{ key: "audience", label: "Audience", value: "儿童" }],
        single_choice: [],
      },
    });
  });

  it("keeps hidden intent unchanged while applying visible option selections", () => {
    const brief = {
      name: "director_brief",
      title: "Director Brief",
      intent: "story",
      project_name: "小马过河",
      exam: {
        input_parameter: [],
        fill_blank: [],
        single_choice: [
          {
            key: "aspect_ratio",
            label: "Aspect Ratio",
            options: [
              { value: "16:9", label: "16:9", default: 1 },
              { value: "9:16", label: "9:16", default: 0 },
              { value: "1:1", label: "1:1", default: 0 },
            ],
          },
          {
            key: "art_style",
            label: "Art Style",
            options: [
              { value: "Ghibli-style", label: "Ghibli-style", default: 1 },
              { value: "Pixel Art", label: "Pixel Art", default: 0 },
            ],
          },
        ],
        multi_choice: [],
      },
    };

    expect(
      buildModifiedDirectorBrief(
        brief,
        {},
        {},
        {
          aspect_ratio: "1:1",
          art_style: "Pixel Art",
        },
      ),
    ).toMatchObject({
      intent: "story",
      exam: {
        input_parameter: [],
        single_choice: [
          {
            key: "aspect_ratio",
            options: [
              { value: "16:9", default: 0 },
              { value: "9:16", default: 0 },
              { value: "1:1", default: 1 },
            ],
          },
          {
            key: "art_style",
            options: [
              { value: "Ghibli-style", default: 0 },
              { value: "Pixel Art", default: 1 },
            ],
          },
        ],
      },
    });
  });

  it("preserves art style option image urls when confirming changes", () => {
    const brief = {
      name: "director_brief",
      title: "Director Brief",
      project_name: "小马过河",
      exam: {
        input_parameter: [],
        fill_blank: [],
        single_choice: [
          {
            key: "art_style",
            label: "Art Style",
            options: [
              {
                value: "Ghibli-style",
                label: "Ghibli-style",
                default: 1,
                imageUrl: "/images/adv-style-images/ghibli-2d.png",
              },
              {
                value: "Pixel Art",
                label: "Pixel Art",
                default: 0,
                imageUrl: "/images/adv-style-images/pixel-art.png",
              },
            ],
          },
        ],
        multi_choice: [],
      },
    };

    expect(
      buildModifiedDirectorBrief(
        brief,
        {},
        {},
        {
          art_style: "Pixel Art",
        },
      ),
    ).toMatchObject({
      exam: {
        single_choice: [
          {
            key: "art_style",
            options: [
              {
                value: "Ghibli-style",
                default: 0,
                imageUrl: "/images/adv-style-images/ghibli-2d.png",
              },
              {
                value: "Pixel Art",
                default: 1,
                imageUrl: "/images/adv-style-images/pixel-art.png",
              },
            ],
          },
        ],
      },
    });
  });
});
