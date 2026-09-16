import { describe, it, expect } from "vitest";
import { S3StorageProvider, type S3Sender } from "@/lib/storage/s3";
import { StorageError } from "@/lib/storage/types";

interface SendConfig {
  onSend: (command: unknown) => Promise<{ Body?: unknown }>;
}

function makeProvider(config?: SendConfig) {
  const sent: unknown[] = [];
  const sender: S3Sender = {
    async send(command: unknown): Promise<{ Body?: unknown }> {
      sent.push(command);
      return config ? config.onSend(command) : { Body: undefined };
    },
  };
  return { provider: new S3StorageProvider({ bucket: "zelvoa-test", region: "eu-central-1" }, sender), sent };
}

function inputOf(command: unknown): Record<string, unknown> {
  return (command as { input: Record<string, unknown> }).input;
}

const notFoundErr = { name: "NotFound", $metadata: { httpStatusCode: 404 } };

describe("S3StorageProvider", () => {
  it("writes real bytes to the configured bucket and returns true size and checksum", async () => {
    const { provider, sent } = makeProvider();
    const stored = await provider.put("ws/media/2026/09/a-hello.txt", Buffer.from("hello world"), "text/plain");
    expect(stored.sizeBytes).toBe(11);
    expect(stored.checksum).toBe(
      "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
    );
    expect(stored.key).toBe("ws/media/2026/09/a-hello.txt");
    const cmd = inputOf(sent[0]);
    expect(cmd.Bucket).toBe("zelvoa-test");
    expect(cmd.Key).toBe("ws/media/2026/09/a-hello.txt");
    expect(cmd.ContentType).toBe("text/plain");
    expect(Buffer.from(cmd.Body as Uint8Array).toString()).toBe("hello world");
  });

  it("retrieves bytes back from the bucket", async () => {
    const { provider } = makeProvider({
      onSend: async () => ({
        Body: { transformToByteArray: async () => new Uint8Array(Buffer.from("payload")) },
      }),
    });
    const data = await provider.get("ws/a.txt");
    expect(data.toString()).toBe("payload");
  });

  it("supports streaming reads for API image/file responses", async () => {
    const { provider } = makeProvider({
      onSend: async () => ({
        Body: { transformToWebStream: async () => new ReadableStream<Uint8Array>() },
      }),
    });
    const stream = await provider.getStream("ws/a.txt");
    expect(stream).toBeInstanceOf(ReadableStream);
  });

  it("throws NOT_FOUND for missing objects", async () => {
    const { provider } = makeProvider({ onSend: async () => Promise.reject(notFoundErr) });
    try {
      await provider.get("nope.bin");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(StorageError);
      if (err instanceof StorageError) expect(err.code).toBe("NOT_FOUND");
    }
  });

  it("exists reflects whether the key is present in the bucket", async () => {
    const missing = makeProvider({ onSend: async () => Promise.reject(notFoundErr) });
    expect(await missing.provider.exists("nope.bin")).toBe(false);

    const present = makeProvider({ onSend: async () => ({ Body: undefined }) });
    expect(await present.provider.exists("k.bin")).toBe(true);
  });

  it("delete completes against the bucket", async () => {
    const { provider } = makeProvider();
    expect(await provider.delete("k.bin")).toBe(true);
  });

  it("move issues a server-side copy followed by a delete", async () => {
    const { provider, sent } = makeProvider();
    await provider.move("from/a.txt", "to/a.txt");
    expect(inputOf(sent[0]).CopySource).toBe("zelvoa-test%2Ffrom%2Fa.txt");
    expect(inputOf(sent[0]).Key).toBe("to/a.txt");
    expect(inputOf(sent[1]).Key).toBe("from/a.txt");
  });
});