export type PresignedUpload = {
  uploadId: string;
  objectKey: string;
  uploadUrl: string;
  publicUrl: string;
};

export interface StorageAdapter {
  getPublicUrl(objectKey: string): string;
  createPresignedUpload(input: {
    fileName: string;
    mimeType: string;
    size?: number;
    prefix?: string;
  }): Promise<PresignedUpload>;
  putObject(input: {
    objectKey: string;
    body: Buffer | Uint8Array | string;
    contentType: string;
  }): Promise<{ publicUrl: string }>;
}
