import { describe, expect, it } from "vitest";
import { filterReusableVisualSubjects, isReusableVisualSubject } from "./planning-subjects";

describe("planning subject classification", () => {
  it("keeps subjects with type character or object", () => {
    expect(
      filterReusableVisualSubjects([
        {
          name: "小马",
          description: "一只勇敢的小马",
          promptText: "brave pony character",
          type: "character",
        },
        {
          name: "河流",
          description: "一条清澈的河流",
          promptText: "clear river",
          type: "object",
        },
      ]).map((subject) => subject.name),
    ).toEqual(["小马", "河流"]);
  });

  it("excludes subjects without type character or object", () => {
    expect(
      filterReusableVisualSubjects([
        {
          name: "小马",
          type: "character",
        },
        {
          name: "背景",
          type: "environment",
        },
        {
          name: "天空",
        },
      ]).map((subject) => subject.name),
    ).toEqual(["小马"]);
  });

  it("keeps reusable foreground props", () => {
    expect(isReusableVisualSubject({
      name: "魔法钥匙",
      type: "object",
    })).toBe(true);
  });
});
