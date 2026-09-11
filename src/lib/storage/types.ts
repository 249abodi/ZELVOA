export interface StoredObject {
  key: string;
  sizeBytes: number;
  contentType: string | null;
  checksum: string;
}

export type ObjectStream = NodeJS.ReadableStream | ReadableStream<Uint8Array>;

export interface StorageProvider {
  readonly name: string;
  /**
   * Writes an object and returns its stored metadata (size + checksum),
   * which are computed on the provider side — the caller cannot fake them.
   */
  put(key: string, data: Buffer, contentType: string | null): Promise<StoredObject>;
  get(key: string): Promise<Buffer>;
  getStream(key: string): Promise<ObjectStream>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  move(fromKey: string, toKey: string): Promise<boolean>;
}

export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "NOT_FOUND"
      | "INVALID_KEY"
      | "IO_ERROR"
      | "QUOTA_EXCEEDED"
      | "NOT_SUPPORTED"
  ) {
    super(message);
    this.name = "StorageError";
  }
}