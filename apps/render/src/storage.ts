import fs from "node:fs";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { config } from "./config.js";

export const s3Client = new S3Client({
  endpoint: config.s3.endpoint,
  region: config.s3.region,
  credentials: {
    accessKeyId: config.s3.accessKeyId,
    secretAccessKey: config.s3.secretAccessKey,
  },
  forcePathStyle: config.s3.forcePathStyle,
});

export function getPublicUrl(objectKey: string) {
  return `${config.s3.publicEndpoint.replace(/\/$/, "")}/${config.s3.bucket}/${objectKey}`;
}

export async function putObject(input: {
  objectKey: string;
  body: Buffer | Uint8Array | string;
  contentType: string;
}) {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: config.s3.bucket,
      Key: input.objectKey,
      Body: input.body,
      ContentType: input.contentType,
    }),
  );
  return { publicUrl: getPublicUrl(input.objectKey) };
}

function detectContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  };
  return map[ext] || "application/octet-stream";
}

export async function uploadFile(
  filePath: string,
  key: string,
): Promise<{ Location: string }> {
  const contentType = detectContentType(filePath);
  const fileStream = fs.createReadStream(filePath);

  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: config.s3.bucket,
      Key: key,
      Body: fileStream,
      ContentType: contentType,
    },
  });

  await upload.done();
  const publicUrl = getPublicUrl(key);
  return { Location: publicUrl };
}
