import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const provider = process.env.STORAGE_PROVIDER ?? "mock";

export interface UploadInput {
  buffer: Buffer;
  contentType: string;
  prefix: string;
  extension?: string;
}

export interface StorageProvider {
  upload(input: UploadInput): Promise<{ key: string; url: string }>;
  delete(key: string): Promise<void>;
  signedUploadUrl(opts: {
    key: string;
    contentType: string;
    expiresIn?: number;
  }): Promise<string>;
}

class S3Provider implements StorageProvider {
  private client: S3Client;
  private bucket: string;
  private publicUrl: string;

  constructor() {
    this.client = new S3Client({
      region: process.env.STORAGE_REGION ?? "auto",
      endpoint: process.env.STORAGE_ENDPOINT,
      credentials: {
        accessKeyId: process.env.STORAGE_ACCESS_KEY_ID!,
        secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: provider === "r2",
    });
    this.bucket = process.env.STORAGE_BUCKET!;
    this.publicUrl = process.env.STORAGE_PUBLIC_URL ?? "";
  }

  async upload({ buffer, contentType, prefix, extension }: UploadInput) {
    const ext = extension ?? contentType.split("/")[1]?.split("+")[0] ?? "bin";
    const key = `${prefix}/${randomUUID()}.${ext}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    return { key, url: `${this.publicUrl}/${key}` };
  }

  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async signedUploadUrl({
    key,
    contentType,
    expiresIn = 300,
  }: {
    key: string;
    contentType: string;
    expiresIn?: number;
  }) {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn },
    );
  }
}

class MockProvider implements StorageProvider {
  async upload({ prefix, extension }: UploadInput) {
    const key = `${prefix}/${randomUUID()}.${extension ?? "jpg"}`;
    // Placeholder image (servicio público que no requiere auth)
    const seed = randomUUID().slice(0, 8);
    return {
      key,
      url: `https://placehold.co/800x800/0A0B0E/C9A961.png?text=navaxa+${seed}`,
    };
  }
  async delete() {
    /* no-op */
  }
  async signedUploadUrl({ key }: { key: string }) {
    return `https://mock.navaxa.app/upload/${key}`;
  }
}

export const storage: StorageProvider =
  provider === "r2" || provider === "s3" ? new S3Provider() : new MockProvider();
