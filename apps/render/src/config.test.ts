import { describe, expect, it } from "vitest";
import {
  DEFAULT_BGM_VOLUME,
  DEFAULT_SUBTITLE_STYLE,
  DEFAULT_TITLE_STYLE,
  config,
} from "./config.js";

describe("config", () => {
  it("has redis defaults", () => {
    expect(config.redis.host).toBe("127.0.0.1");
    expect(config.redis.port).toBe(6379);
  });

  it("has s3 defaults", () => {
    expect(config.s3.region).toBe("us-east-1");
    expect(config.s3.bucket).toBe("open-director");
    expect(config.s3.forcePathStyle).toBe(true);
  });

  it("has a default queue name", () => {
    expect(config.queueName).toBe("open-director-render");
  });
});

describe("DEFAULT_SUBTITLE_STYLE", () => {
  it("defines font size, color, and stroke", () => {
    expect(DEFAULT_SUBTITLE_STYLE.fontSize).toBe(50);
    expect(DEFAULT_SUBTITLE_STYLE.color).toBe("#ffffff");
    expect(DEFAULT_SUBTITLE_STYLE.stroke).toBe("#000000");
    expect(DEFAULT_SUBTITLE_STYLE.align).toBe("center");
  });
});

describe("DEFAULT_TITLE_STYLE", () => {
  it("defines a larger font size than subtitles", () => {
    expect(DEFAULT_TITLE_STYLE.fontSize).toBe(80);
    expect(DEFAULT_TITLE_STYLE.fontSize).toBeGreaterThan(DEFAULT_SUBTITLE_STYLE.fontSize);
  });
});

describe("DEFAULT_BGM_VOLUME", () => {
  it("is a sensible low volume", () => {
    expect(DEFAULT_BGM_VOLUME).toBeGreaterThan(0);
    expect(DEFAULT_BGM_VOLUME).toBeLessThan(1);
  });
});
