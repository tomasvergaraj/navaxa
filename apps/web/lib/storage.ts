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
    return `https://mock.navaxa.cl/upload/${key}`;
  }
}

export const storage: StorageProvider =
  provider === "r2" || provider === "s3" ? new S3Provider() : new MockProvider();

/**
 * Deriva la key del objeto desde su URL pública.
 *
 * Las filas creadas antes de que se guardara la key (logoKey, avatarKey,
 * imageKey…) solo tienen la URL; sin esto sus archivos quedarían huérfanos en el
 * bucket para siempre. Devuelve null si la URL no cuelga de STORAGE_PUBLIC_URL
 * — p. ej. los placeholders de placehold.co que emite el MockProvider, que no
 * son nuestros y no hay que intentar borrar.
 */
export function storageKeyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const base = (process.env.STORAGE_PUBLIC_URL ?? "").replace(/\/+$/, "");
  if (!base || !url.startsWith(`${base}/`)) return null;
  const path = url.slice(base.length + 1).split(/[?#]/)[0];
  if (!path) return null;
  try {
    return decodeURIComponent(path);
  } catch {
    return path; // URL mal codificada: mejor intentar con el crudo que no borrar.
  }
}

/**
 * Borra el objeto del bucket sin poder tumbar el request.
 *
 * El borrado en storage siempre corre DESPUÉS de escribir la BD: si R2 falla, el
 * usuario ya no ve la imagen y lo único que queda es un archivo huérfano (un
 * costo menor), mientras que propagar el error le mostraría un 500 sobre una
 * operación que en realidad se completó.
 */
export async function deleteStoredObject(ref: {
  key?: string | null;
  url?: string | null;
}): Promise<void> {
  const key = ref.key ?? storageKeyFromUrl(ref.url);
  if (!key) return;
  try {
    await storage.delete(key);
  } catch (e) {
    console.error("[storage] no se pudo borrar el objeto", key, e);
  }
}

/**
 * {@link deleteStoredObject} sobre varios objetos, de a tandas: borrar la galería
 * entera de un cliente puede ser cientos de archivos y no queremos abrir cientos
 * de conexiones a R2 de golpe.
 */
export async function deleteStoredObjects(
  refs: Array<{ key?: string | null; url?: string | null }>,
): Promise<void> {
  const BATCH = 20;
  for (let i = 0; i < refs.length; i += BATCH) {
    await Promise.all(refs.slice(i, i + BATCH).map((r) => deleteStoredObject(r)));
  }
}
