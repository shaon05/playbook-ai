import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ApiEnv } from "../../config/env";
import type { StorageObjectMetadata, StorageProvider, StorageUpload } from "./storage.provider";

export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly env: ApiEnv) {
    this.client = new S3Client({
      region: env.AWS_REGION,
      ...(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY ? { credentials: { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY, ...(env.AWS_SESSION_TOKEN ? { sessionToken: env.AWS_SESSION_TOKEN } : {}) } } : {}),
    });
    this.bucket = env.AWS_S3_BUCKET;
  }

  async createUploadUrl(input: { key: string; contentType: string; contentLength: number; expiresInSeconds: number }): Promise<StorageUpload> {
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: input.key, ContentType: input.contentType, ContentLength: input.contentLength });
    const url = await getSignedUrl(this.client, command, { expiresIn: input.expiresInSeconds });
    return { bucket: this.bucket, key: input.key, url, expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000).toISOString(), headers: { "Content-Type": input.contentType, "Content-Length": String(input.contentLength) } };
  }

  async createDownloadUrl(input: { key: string; contentType?: string; expiresInSeconds: number }): Promise<StorageUpload> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: input.key, ...(input.contentType ? { ResponseContentType: input.contentType } : {}) });
    const url = await getSignedUrl(this.client, command, { expiresIn: input.expiresInSeconds });
    return { bucket: this.bucket, key: input.key, url, expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000).toISOString(), headers: {} };
  }

  async getObjectMetadata(input: { key: string }): Promise<StorageObjectMetadata | null> {
    try {
      const result = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: input.key }));
      return { contentLength: result.ContentLength, contentType: result.ContentType, etag: result.ETag };
    } catch (error) {
      const name = error && typeof error === "object" && "name" in error ? error.name : undefined;
      if (name === "NotFound" || name === "NoSuchKey" || name === "NoSuchBucket") return null;
      throw error;
    }
  }

  async deleteObject(input: { key: string }): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: input.key }));
  }

  async downloadObject(input: { key: string; destination: string }): Promise<void> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: input.key }));
    if (!result.Body) throw new Error("S3 object body was empty");
    await pipeline(result.Body as NodeJS.ReadableStream, createWriteStream(input.destination));
  }

  async putObject(input: { key: string; body: Uint8Array; contentType: string; contentEncoding?: string }): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: input.key, Body: input.body, ContentType: input.contentType, ContentEncoding: input.contentEncoding }));
  }
}
