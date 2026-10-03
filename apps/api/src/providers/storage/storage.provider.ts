export type StorageUpload = {
  bucket: string;
  key: string;
  url: string;
  expiresAt: string;
  headers: Record<string, string>;
};

export type StorageObjectMetadata = {
  contentLength?: number;
  contentType?: string;
  etag?: string;
};

export interface StorageProvider {
  createUploadUrl(input: { key: string; contentType: string; contentLength: number; expiresInSeconds: number }): Promise<StorageUpload>;
  createDownloadUrl?(input: { key: string; contentType?: string; expiresInSeconds: number }): Promise<StorageUpload>;
  getObjectMetadata(input: { key: string }): Promise<StorageObjectMetadata | null>;
  deleteObject(input: { key: string }): Promise<void>;
  downloadObject(input: { key: string; destination: string }): Promise<void>;
  putObject(input: { key: string; body: Uint8Array; contentType: string; contentEncoding?: string }): Promise<void>;
}
