import path from "node:path";
import fs from "fs-extra";

export const config = {
  redis: {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  queueName: process.env.RENDER_QUEUE_NAME || "open-director-render",
  s3: {
    endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
    publicEndpoint:
      process.env.S3_PUBLIC_ENDPOINT ||
      process.env.S3_ENDPOINT ||
      "http://localhost:9000",
    region: process.env.S3_REGION || "us-east-1",
    bucket: process.env.S3_BUCKET || "open-director",
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "opendirector",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "opendirector-secret",
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE || "true") === "true",
  },
};

export const cacheDir = path.join(process.cwd(), "cache");
export const outputDir = path.join(process.cwd(), "output");

fs.ensureDirSync(cacheDir);
fs.ensureDirSync(outputDir);

export const DEFAULT_SUBTITLE_STYLE = {
  fontFamily:
    "Sarasa UI SC, Noto Sans CJK SC, Noto Sans CJK TC, Noto Sans CJK JP, Noto Sans CJK KR, Noto Sans, Noto Sans Devanagari, Noto Sans Arabic, Noto Sans Hebrew, Noto Sans Thai, Microsoft YaHei, PingFang SC, sans-serif",
  fontSize: 50,
  color: "#ffffff",
  stroke: "#000000",
  strokeThickness: 4,
  align: "center",
  dropShadow: true,
  dropShadowColor: "#000000",
  dropShadowBlur: 2,
  dropShadowDistance: 2,
};

export const DEFAULT_TITLE_STYLE = {
  fontFamily:
    "Sarasa UI SC, Noto Sans CJK SC, Noto Sans CJK TC, Noto Sans CJK JP, Noto Sans CJK KR, Noto Sans, Noto Sans Devanagari, Noto Sans Arabic, Noto Sans Hebrew, Noto Sans Thai, Microsoft YaHei, PingFang SC, sans-serif",
  fontSize: 80,
  color: "#ffffff",
  stroke: "#000000",
  strokeThickness: 2,
  align: "center",
  dropShadow: true,
  dropShadowColor: "#000000",
  dropShadowBlur: 0,
  dropShadowDistance: 2,
};

export const DEFAULT_BGM_VOLUME = 0.15;
