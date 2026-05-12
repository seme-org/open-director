import { NextResponse } from "next/server";
import { z } from "zod";
import { minioStorage } from "@/server/storage/minio";

const schema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().optional(),
  prefix: z.string().optional(),
});

export async function POST(request: Request) {
  const body = schema.parse(await request.json());
  const upload = await minioStorage.createPresignedUpload(body);
  return NextResponse.json(upload);
}
