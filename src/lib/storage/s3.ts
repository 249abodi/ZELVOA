import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import {
  StorageError,
  type StorageProvider,
  type StoredObject,
  type ObjectStream,
} from "@/lib/storage/types";

export interface S3StorageConfig {
  bucket: string;
  region: string;
  endpoint?: string;
  forcePathStyle?: boolean;
}

interface S3SendResult {
  Body?: unknown;
}

export interface S3Sender {
  send(command: unknown): Promise<S3SendResult>;
}

function isObjectNotFound(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const code =
    (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404 ||
    (err as { name?: string }).name === "NotFound" ||
    (err as { name?: string }).name === "NoSuchKey" ||
    (err as { Code?: string }).Code === "NotFound" ||
    (err as { Code?: string }).Code === "NoSuchKey";
  return code;
}

async function toBuffer(body: unknown): Promise<Buffer> {
  if (typeof (body as { transformToByteArray?: unknown }).transformToByteArray === "function") {
    const bytes = await (body as { transformToByteArray(): Promise<Uint8Array> }).transformToByteArray();
    return Buffer.from(bytes);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Buffer | string>) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function toWebStream(body: unknown): ReadableStream<Uint8Array> {
  if (typeof (body as { transformToWebStream?: unknown }).transformToWebStream === "function") {
    return (body as { transformToWebStream(): ReadableStream<Uint8Array> }).transformToWebStream();
  }
  return Readable.toWeb(body as Readable) as ReadableStream<Uint8Array>;
}

function mapError(err: unknown): never {
  throw new StorageError(
    isObjectNotFound(err) ? "Object not found." : "Could not read object.",
    isObjectNotFound(err) ? "NOT_FOUND" : "IO_ERROR"
  );
}

/**
 * S3-compatible object storage provider.
 *
 * Bytes live in a bucket instead of the function filesystem, so uploads
 * persist on serverless platforms (Vercel) where the local filesystem is
 * read-only and ephemeral. Credentials are resolved by the AWS SDK from the
 * standard `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` environment
 * variables and are never exposed by this provider.
 */
export class S3StorageProvider implements StorageProvider {
  readonly name = "s3";
  private readonly bucket: string;
  private readonly client: S3Sender;

  constructor(config: S3StorageConfig, client?: S3Sender) {
    this.bucket = config.bucket;
    this.client =
      client ??
      (new S3Client({
        region: config.region,
        ...(config.endpoint ? { endpoint: config.endpoint } : {}),
        ...(config.forcePathStyle ? { forcePathStyle: true } : {}),
      }) as unknown as S3Sender);
  }

  async put(key: string, data: Buffer, contentType: string | null): Promise<StoredObject> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: data,
      ...(contentType ? { ContentType: contentType } : {}),
    });
    try {
      await this.client.send(command);
    } catch {
      throw new StorageError("Could not write object.", "IO_ERROR");
    }
    const checksum = createHash("sha256").update(data).digest("hex");
    return { key, sizeBytes: data.length, contentType, checksum };
  }

  async get(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    let out: S3SendResult;
    try {
      out = await this.client.send(command);
    } catch (err) {
      mapError(err);
    }
    if (!out!.Body) throw new StorageError("Object not found.", "NOT_FOUND");
    return await toBuffer(out!.Body);
  }

  async getStream(key: string): Promise<ObjectStream> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    let out: S3SendResult;
    try {
      out = await this.client.send(command);
    } catch (err) {
      mapError(err);
    }
    if (!out!.Body) throw new StorageError("Object not found.", "NOT_FOUND");
    return toWebStream(out!.Body);
  }

  async exists(key: string): Promise<boolean> {
    const command = new HeadObjectCommand({ Bucket: this.bucket, Key: key });
    try {
      await this.client.send(command);
      return true;
    } catch (err) {
      return isObjectNotFound(err) ? false : mapError(err);
    }
  }

  async delete(key: string): Promise<boolean> {
    const command = new DeleteObjectCommand({ Bucket: this.bucket, Key: key });
    try {
      await this.client.send(command);
      return true;
    } catch (err) {
      return mapError(err);
    }
  }

  async move(fromKey: string, toKey: string): Promise<boolean> {
    const source = encodeURIComponent(`${this.bucket}/${fromKey}`);
    const command = new CopyObjectCommand({
      Bucket: this.bucket,
      Key: toKey,
      CopySource: source,
    });
    try {
      await this.client.send(command);
    } catch (err) {
      return mapError(err);
    }
    await this.delete(fromKey);
    return true;
  }
}

export const defineS3Provider = (config: S3StorageConfig, client?: S3Sender) =>
  new S3StorageProvider(config, client);