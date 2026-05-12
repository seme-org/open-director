import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { prisma } from "@/server/db/prisma";
import type { PresignedUpload, StorageAdapter } from "./types";

function env(name: string, fallback = "") {
  return process.env[name] || fallback;
}

const bucket = env("S3_BUCKET", "open-director");
const publicEndpoint = env("S3_PUBLIC_ENDPOINT", env("S3_ENDPOINT", "http://localhost:9000"));

export const s3Client = new S3Client({
  endpoint: env("S3_ENDPOINT", "http://localhost:9000"),
  region: env("S3_REGION", "us-east-1"),
  credentials: {
    accessKeyId: env("S3_ACCESS_KEY_ID", "opendirector"),
    secretAccessKey: env("S3_SECRET_ACCESS_KEY", "opendirector-secret"),
  },
  forcePathStyle: env("S3_FORCE_PATH_STYLE", "true") === "true",
});

function safeName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-96);
}

export const minioStorage: StorageAdapter = {
  getPublicUrl(objectKey: string) {
    return `${publicEndpoint.replace(/\/$/, "")}/${bucket}/${objectKey}`;
  },

  async createPresignedUpload(input): Promise<PresignedUpload> {
    const uploadId = randomUUID();
    const objectKey = `${input.prefix ?? "uploads"}/${uploadId}-${safeName(input.fileName)}`;
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: input.mimeType,
    });
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 * 10 });
    const publicUrl = this.getPublicUrl(objectKey);

    await prisma.upload.create({
      data: {
        id: uploadId,
        objectKey,
        fileName: input.fileName,
        mimeType: input.mimeType,
        size: input.size ? BigInt(input.size) : null,
      },
    });

    return { uploadId, objectKey, uploadUrl, publicUrl };
  },

  async putObject(input) {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: input.objectKey,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
    return { publicUrl: this.getPublicUrl(input.objectKey) };
  },
};
