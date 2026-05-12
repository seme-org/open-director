import { describe, expect, it } from "vitest";
import { getPublicUrl } from "./storage.js";

describe("getPublicUrl", () => {
  it("combines endpoint, bucket, and object key into a url", () => {
    const url = getPublicUrl("renders/task-1.mp4");
    expect(url).toMatch(/^http:\/\/localhost:9000\/open-director\/renders\/task-1\.mp4$/);
  });

  it("handles object keys with nested paths", () => {
    const url = getPublicUrl("images/subfolder/photo.png");
    expect(url).toContain("open-director/images/subfolder/photo.png");
  });
});
